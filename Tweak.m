#import <Foundation/Foundation.h>
#import <UIKit/UIKit.h>
#import <WebKit/WebKit.h>
#import "generated/Players.h"

static __weak WKWebView *activeView;
static NSHashTable<WKWebView *> *busyViews;
static NSString *players;

static dispatch_queue_t logQueue;
static NSString *logPath;

static void LogDiagnostic(NSString *message) {
    NSLog(@"[LinkedWin] %@", message);
    NSData *line = [[NSString stringWithFormat:@"%.3f %@\n", NSDate.date.timeIntervalSince1970, message] dataUsingEncoding:NSUTF8StringEncoding];
    dispatch_async(logQueue, ^{
        @try {
            NSFileManager *manager = NSFileManager.defaultManager;
            if (![manager fileExistsAtPath:logPath]) [manager createFileAtPath:logPath contents:nil attributes:nil];
            NSFileHandle *file = [NSFileHandle fileHandleForWritingAtPath:logPath];
            if (!file) return;
            if ([file seekToEndOfFile] + line.length > 262144) { [file truncateFileAtOffset:0]; [file seekToFileOffset:0]; }
            [file writeData:line];
            [file closeFile];
        } @catch (NSException *error) {
            NSLog(@"[LinkedWin] Unable to write diagnostic log");
        }
    });
}

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
        if (error) { [busyViews removeObject:current]; LogDiagnostic([NSString stringWithFormat:@"WebView evaluation failed: %@ %ld", error.domain, (long)error.code]); return; }
        if ([result isKindOfClass:NSString.class] && [result isEqualToString:@"INSTALL"] && current == activeView) {
            [current evaluateJavaScript:players completionHandler:^(id value, NSError *installError) {
                WKWebView *installed = weakWeb;
                if (installed) [busyViews removeObject:installed];
                if (installError) LogDiagnostic([NSString stringWithFormat:@"Player installation failed: %@ %ld", installError.domain, (long)installError.code]);
                else if (installed == activeView && UIApplication.sharedApplication.applicationState == UIApplicationStateActive) PollBoard();
            }];
        } else {
            [busyViews removeObject:current];
            if (![result isKindOfClass:NSString.class]) return;
            NSData *data = [result dataUsingEncoding:NSUTF8StringEncoding];
            NSDictionary *report = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
            if (![report isKindOfClass:NSDictionary.class] || ![report[@"diagnostics"] isKindOfClass:NSArray.class]) return;
            for (id event in report[@"diagnostics"]) {
                if (![event isKindOfClass:NSDictionary.class]) continue;
                NSData *entry = [NSJSONSerialization dataWithJSONObject:event options:0 error:nil];
                if (entry) LogDiagnostic([[NSString alloc] initWithData:entry encoding:NSUTF8StringEncoding]);
            }
        }
    }];
}

__attribute__((constructor)) static void StartPlayers(void) {
    if (![NSBundle.mainBundle.bundleIdentifier isEqualToString:@"com.linkedin.LinkedIn"]) return;
    dispatch_async(dispatch_get_main_queue(), ^{
        logQueue = dispatch_queue_create("com.liam.linkedwin.log", DISPATCH_QUEUE_SERIAL);
        logPath = [NSSearchPathForDirectoriesInDomains(NSCachesDirectory, NSUserDomainMask, YES).firstObject stringByAppendingPathComponent:@"LinkedWin.log"];
        LogDiagnostic([NSString stringWithFormat:@"LinkedWin 0.2.0-beta3; app %@; iOS %@; completion floor 3250 ms", [NSBundle.mainBundle objectForInfoDictionaryKey:@"CFBundleShortVersionString"], UIDevice.currentDevice.systemVersion]);
        busyViews = [NSHashTable weakObjectsHashTable];
        players = [[NSString alloc] initWithBytes:kPlayers length:sizeof(kPlayers)-1 encoding:NSUTF8StringEncoding];
        [NSNotificationCenter.defaultCenter addObserverForName:UIApplicationWillResignActiveNotification object:nil queue:NSOperationQueue.mainQueue usingBlock:^(NSNotification *note) { StopPlayer(NO); }];
        [NSTimer scheduledTimerWithTimeInterval:0.25 repeats:YES block:^(NSTimer *timer) { PollBoard(); }];
    });
}
