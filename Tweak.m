#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import "generated/Players.h"

static __weak WKWebView *activeView;
static NSHashTable<WKWebView *> *busyViews;
static NSString *players;

static void StopPlayer(BOOL discard) {
    [activeView evaluateJavaScript:discard ? @"window.__linkedWinStop?.(true)" : @"window.__linkedWinStop?.()" completionHandler:nil];
    activeView = nil;
}

static WKWebView *FindBoard(UIView *view, NSSet<NSString *> *games, NSUInteger *remaining) {
    if (!*remaining) return nil;
    (*remaining)--;
    if (view.hidden || view.alpha < 0.01) return nil;
    if ([view isKindOfClass:WKWebView.class]) {
        WKWebView *web = (WKWebView *)view;
        NSURL *url = web.URL;
        NSArray<NSString *> *parts = url.path.pathComponents;
        if ([url.scheme isEqualToString:@"https"] && [url.host isEqualToString:@"www.linkedin.com"] &&
            parts.count == 4 && [parts[1] isEqualToString:@"games"] &&
            [parts[2] isEqualToString:@"view"] && [games containsObject:parts[3]] &&
            !CGRectIsEmpty(CGRectIntersection([web convertRect:web.bounds toView:web.window], web.window.bounds))) return web;
        return nil;
    }
    for (UIView *child in view.subviews.reverseObjectEnumerator) {
        WKWebView *found = FindBoard(child, games, remaining);
        if (found) return found;
        if (!*remaining) break;
    }
    return nil;
}

static void PollBoard(void) {
    UIApplication *app = UIApplication.sharedApplication;
    if (app.applicationState != UIApplicationStateActive) { StopPlayer(NO); return; }
    static NSSet<NSString *> *games;
    if (!games) games = [NSSet setWithArray:@[@"zip", @"tango", @"queens", @"mini-sudoku", @"patches", @"wend", @"crossclimb", @"pinpoint"]];
    WKWebView *web = nil;
    NSUInteger remaining = 2000;
    for (UIScene *scene in app.connectedScenes) {
        if (![scene isKindOfClass:UIWindowScene.class] || scene.activationState != UISceneActivationStateForegroundActive) continue;
        for (UIWindow *window in ((UIWindowScene *)scene).windows.reverseObjectEnumerator) {
            web = FindBoard(window, games, &remaining);
            if (web || !remaining) break;
        }
        if (web || !remaining) break;
    }
    if (web != activeView) { StopPlayer(YES); activeView = web; }
    if (!web || [busyViews containsObject:web]) return;
    [busyViews addObject:web];
    __weak WKWebView *weakWeb = web;
    [web evaluateJavaScript:@"typeof window.__linkedWinTick === 'function' ? window.__linkedWinTick() : 'INSTALL'"
         completionHandler:^(id result, NSError *error) {
        WKWebView *current = weakWeb;
        if (!current) return;
        if (error) { [busyViews removeObject:current]; return; }
        if ([result isKindOfClass:NSString.class] && [result isEqualToString:@"INSTALL"] && current == activeView) {
            [current evaluateJavaScript:players completionHandler:^(id value, NSError *installError) {
                WKWebView *installed = weakWeb;
                if (installed) [busyViews removeObject:installed];
                if (installError) NSLog(@"[LinkedWin] Player installation failed: %@", installError.localizedDescription);
                else if (installed == activeView && UIApplication.sharedApplication.applicationState == UIApplicationStateActive) PollBoard();
            }];
        } else {
            [busyViews removeObject:current];
            if (![result isKindOfClass:NSString.class]) return;
            NSData *data = [result dataUsingEncoding:NSUTF8StringEncoding];
            NSDictionary *report = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
            for (NSString *event in report[@"events"]) {
                // Keep raw account/save payloads out of the native system log.
                if ([event rangeOfString:@"SAVE"].location == NSNotFound &&
                    [event rangeOfString:@"REQUEST"].location == NSNotFound &&
                    [event rangeOfString:@"RESPONSE"].location == NSNotFound) NSLog(@"[LinkedWin] %@", event);
            }
        }
    }];
}

__attribute__((constructor)) static void StartPlayers(void) {
    if (![NSBundle.mainBundle.bundleIdentifier isEqualToString:@"com.linkedin.LinkedIn"]) return;
    dispatch_async(dispatch_get_main_queue(), ^{
        busyViews = [NSHashTable weakObjectsHashTable];
        players = [[NSString alloc] initWithBytes:kPlayers length:sizeof(kPlayers)-1 encoding:NSUTF8StringEncoding];
        [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationWillResignActiveNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) { StopPlayer(NO); }];
        [NSTimer scheduledTimerWithTimeInterval:0.25 repeats:YES block:^(NSTimer *timer) { PollBoard(); }];
    });
}
