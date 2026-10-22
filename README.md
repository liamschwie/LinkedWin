# LinkedWin

A jailbreak tweak that automatically plays LinkedIn's minigames when their boards are ready. Open a supported game normally; LinkedWin recognizes the page and plays it without a Solve button or a running Frida session.

**Version 0.2.0-beta1 is a prerelease.** The individual players have the phone evidence described below, but the native tweak loader and faster pacing still need device testing.

## Features

- Recognizes **Zip, Tango, Queens, Mini Sudoku, Patches, Wend, Crossclimb and Pinpoint**.
- Uses the puzzle data already loaded by the app and its normal input handlers.
- Checks puzzle constraints before playing, including Zip's active walls and numbered checkpoints.
- Skips correct existing entries where supported and stops on conflicting or unsupported state.
- Removes unnecessary pauses after confirmed input while preserving state checks and calibrated drag/reorder stages.
- Cancels when the page is hidden or LinkedIn backgrounds, and creates fresh player state when switching games.
- Targets only `com.linkedin.LinkedIn`; no settings or separate account setup are required.

The package does not change clocks, fabricate completion records, or include LinkedIn, an IPA, credentials or app assets.

## How It Works

LinkedWin looks for a visible LinkedIn game WebView in the foreground app. It recognizes the game from its URL, installs the corresponding page functions, validates the board and starts one automatic run when ready.

The players use normal cell input, drag events, keyboard row sorting or form submission. Each adapter checks the resulting application state where its verified reader supports it. Navigation and cancellation stop the old player before another game starts.

## Compatible Versions

The existing player development targeted:

- LinkedIn's iOS app, bundle identifier `com.linkedin.LinkedIn`
- iOS **17.3.1** using **Relaxin / RootHide**
- The eight game formats listed above; Mini Sudoku currently supports the captured **6×6** layout

Pinpoint's original Frida player was confirmed to submit `Fruits` as `END_SOLVED`, with the matching server update acknowledged. Earlier Zip, Tango, Mini Sudoku, Patches and Wend runs also have device evidence. Queens has only completed-board no-op evidence; Crossclimb's earlier post-completion termination remains undiagnosed.

The new native package, faster timings and general daily-board compatibility are not yet phone-verified. See [testing status and known limits](docs/DETAILS.md#known-limits-that-still-need-phone-evidence) before relying on it.

## Installation

### From a .deb (Releases)

1. Download **`LinkedWin_0.2.0-beta1_roothide.deb`** from [Releases](https://github.com/liamschwie/LinkedWin/releases/tag/v0.2.0-beta1).
2. Remove the earlier **LinkedIn Games** test package if installed, and end Frida player sessions.
3. Install with Filza or your jailbreak's package manager.
4. Fully close and reopen LinkedIn, then open one intended unfinished game board.

**Tweak injection must be enabled for LinkedIn.** This is a native RootHide package (`iphoneos-arm64e`), not a standard rootless package. It does not require RootHide Patcher conversion.

Opening an unfinished board may start its clock. Confirm the board completes and check its saved result after reopening it. To cancel, leave the game or background LinkedIn. To disable it completely, close LinkedIn and remove/disable LinkedWin through your jailbreak/package manager.

### Building from source

Requires [RootHide's Theos fork](https://github.com/roothide/theos), Xcode's iPhoneOS SDK, Node.js, make, ldid and Debian packaging tools.

```bash
git clone https://github.com/liamschwie/LinkedWin.git
cd LinkedWin
export THEOS=/path/to/roothide-theos
node scripts/test.cjs
make clean package FINALPACKAGE=1
```

The `.deb` will be in `packages/`. The default build uses the **RootHide** scheme and includes arm64 and arm64e slices. The release toolchain revision and individual Frida diagnostics are recorded in [development details](docs/DETAILS.md#build-and-test).

## Technical Details

- **`Tweak.m`** — Checks visible game WebViews every 250 ms while LinkedIn is active and starts the page player immediately after installation. It does not replace the app's navigation delegate or swizzle WebView methods.
- **`frida/*-play.js`** — Eight individually testable puzzle/input adapters. Their USB launchers are omitted from the native payload.
- **`scripts/bundle.cjs`** — Generates the embedded JavaScript and native header from the same tested adapter functions.
- **`scripts/test.cjs`** — Runs all adapter tests plus game-routing, cancellation, pacing and puzzle-safety checks.

Discovery is bounded to 60 seconds and observation to 180 seconds after starting. Started players drain their status without recreating the helpers each tick. Raw save payloads are excluded from the native `[LinkedWin]` system log; standalone Frida diagnostic logs can contain account data and should stay private.

Zip validates every route step against active walls in both directions, visits every cell once and checks checkpoint order. It does not confuse possible `wallHints` with active walls. It stops if the supplied solution contradicts the active board; it does not attempt a speculative replacement route.

## Requirements

- A jailbroken iOS **17 or later** device with RootHide / Relaxin and a working tweak loader
- The official LinkedIn app, with tweak injection enabled
- A supported, fully visible game board

Unknown schemas, locales and unsupported preset formats stop input. Fresh completed-board detection and arbitrary partial-path resumption in Zip remain unverified. A puzzle replaced in place after a run has finished requires leaving and reopening the game.

See [speed changes, puzzle guards and device evidence](docs/DETAILS.md) for the complete limits. No claim of the maximum reliable device speed is made from local tests alone.

## License

This project is available under the [GNU GPLv3](LICENSE).
