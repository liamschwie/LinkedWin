# LinkedWin

A small RootHide tweak that recognizes the LinkedIn game you open and automatically plays its board through the game's input handlers. No Frida session or Solve button is needed after installation.

**Version 0.2.0-beta1 · RootHide/Relaxin · iOS 17 or later**

Supported adapters: **Zip, Tango, Queens, Mini Sudoku, Patches, Wend, Crossclimb and Pinpoint.** This covers the eight games identified on this account. New games or changed formats need their own adapter.

See [INSTALL.md](../INSTALL.md) for installation and removal.

## What changed

| Area | Earlier build | LinkedWin |
| --- | --- | --- |
| Board detection | One-second scan; another scan after installation | 250 ms scan; immediate first tick after installation |
| Tango | 400 ms extra wait after each confirmed cell | Extra wait removed; confirmation still polls at 20 ms |
| Queens | 100 ms extra wait after each confirmed click | Extra wait removed; state transition still verified |
| Mini Sudoku | 80 ms extra wait after each confirmed number | Extra wait removed; selection and number checks retained |
| Patches | 100 ms extra wait after each committed region | Extra wait removed; drag and committed-state checks retained |
| Wend | 100 ms extra wait after each committed word | Extra wait removed; proven 80 ms drag stages retained |
| Crossclimb | 40 ms extra wait after each confirmed letter | Extra wait removed; focus, keyboard sorting and feedback checks retained |
| Zip | 120 ms per drag stage | One rendering frame per stage; 32 ms fallback when animation frames are unavailable |

These are changes to scheduling, not measured phone speed records. UI rendering, device load, board size, setup time and server acceptance still determine the actual result. No clock, network request or saved record is rewritten. Crossclimb sorting delays and Wend's drag calibration remain until faster timings are verified on the phone. Pinpoint keeps its now phone-tested input/submission timing.

The native payload contains about 87 KB of JavaScript and the compressed package is about 26 KB. Only LinkedIn is targeted. The payload is installed once per document; started players drain their status without rebuilding their helper functions each tick. Discovery is bounded to 60 seconds and observation to 180 seconds after starting. Timeouts use elapsed time, so faster polling does not shorten them.

## Puzzle guards and edge cases

- **Zip walls:** follows the supplied complete route, checks every orthogonal step against active `walls` in both directions, and stops if the route crosses a wall. `wallHints` describe possible hints and are not treated as active walls. If supplied data contradicts itself, it stops rather than inventing a new route. Tests include a valid path around a wall and blocked travel in both directions.
- **Zip structure:** requires every cell exactly once, ordered numbered checkpoints, correct start/finish, valid wall indices/directions, and one visible grid. Reads the current mounted React tree instead of stale startup data, and rechecks puzzle identity, cell elements and geometry during dragging. Cancellation releases the mouse, including cancellation during the first wait. The 12-pixel within-cell motion needed to start dragging is preserved.
- **Tango:** checks balance, triples, equal/opposite edges, givens, ambiguous mounted puzzles, and puzzle identity while confirming input. Uses the existing explicit target-value callback rather than cycling through a wrong value.
- **Queens:** checks one queen per row, column and region, non-touching queens and existing conflicting queens. Verifies every empty/cross/queen transition.
- **Mini Sudoku:** reconstructs regions from matching walls, checks givens and requires exactly one solution. Conflicting existing entries, unconfirmed selection or a disabled target button stop input. Only the captured 6×6 format is supported; notes and other formats are rejected.
- **Patches:** requires non-overlapping rectangular coverage, one clue per region, valid clue area/shape, and confirmed committed regions. Conflicting existing regions stop input.
- **Wend:** checks letter paths, adjacency, holes, overlap and full coverage. Lifts between words, verifies committed paths and skips correct existing words. A completed board can be read even when its drag grid is disabled. Unknown preset formats still stop input.
- **Crossclimb:** validates the full ladder and matches clues to current rows. Requires application feedback for letters and exact order after keyboard sorting. Does not assume shuffled rows are already in solution order.
- **Pinpoint:** validates the accepted-answer list and clues, fills the first supplied answer and submits once. Conflicting guesses, changed source data and disabled/missing forms stop it.
- **Navigation:** only the exact LinkedIn HTTPS host and eight known game paths are accepted. The old player is stopped and discarded when switching games, including navigation within the same WebView. Backgrounding/hiding a page cancels it. Return to the games list and reopen the board to start a fresh session; it does not blindly retry a failed move.

## Known limits that still need phone evidence

- Native tweak injection and the faster pacing have not yet been exercised on the phone. Local tests cannot establish the highest reliable speed or daily-board/server compatibility.
- Zip's fresh completed-board detection is still unverified. Test Zip on an intended unfinished board. Existing progress may be restarted by its drag; this version does not promise to resume an arbitrary partial Zip path. Other players skip existing correct entries where their verified readers support it, and stop on conflicts.
- A puzzle replaced in place without a URL/document change after an automatic run has finished requires leaving and reopening the game. A changing puzzle during active input is guarded by the adapters.
- Some readers use English accessibility/clue text. Unknown locales, schemas, ambiguous boards and unsupported presets fail closed.
- Daily Queens playback has not been verified; prior Queens evidence was completed-board no-op only.
- Crossclimb's earlier post-completion app termination remains undiagnosed. The latest phone run also did not exercise keyboard reordering. No speculative crash fix was added.

## Phone evidence so far

| Game | Existing device evidence |
| --- | --- |
| Zip | Earlier tutorial win accepted; stored 32 seconds, including setup |
| Tango | Earlier 4×4 tutorial win accepted; stored 3 seconds |
| Queens | Completed-board no-op only |
| Mini Sudoku | Tutorial input completed; GraphQL update acknowledged; persistence readback pending |
| Patches | Tutorial win accepted; stored 15 seconds; flawless flag false |
| Wend | Tutorial win accepted; stored 3 seconds; flawless flag false. New disabled-grid reader is locally regression-tested |
| Crossclimb | END_SOLVED submitted and update acknowledged; persistence readback and termination diagnosis pending |
| Pinpoint | User confirmed success: Fruits submitted as END_SOLVED, isMistakeFree=true; matching GraphQL update acknowledged with HTTP 200. Response does not echo a stored-record readback |

All eight adapter test programs plus routing and safety regression checks pass locally. The native library compiles, links, signs and packages for arm64 and arm64e. Earlier Frida successes do not prove this new native package and pacing work on the device.

## Build and test

Requires macOS/Xcode, Node.js, make, ldid, Debian package tools and [RootHide Theos](https://github.com/roothide/theos). Standard Theos without the RootHide scheme will not build this configuration.

```sh
git clone --recursive https://github.com/roothide/theos.git /your/build/path/roothide-theos
export THEOS=/your/build/path/roothide-theos
node scripts/test.cjs
make clean package FINALPACKAGE=1
```

Built here with RootHide Theos `cfba89a53a05b4a1b822121158acc3669c20602f`, its pinned headers/libraries and Xcode's iPhoneOS 26.5 SDK. For that toolchain revision, check out the commit and run `git submodule update --init --recursive`. In a sandbox, point `CLANG_MODULE_CACHE_PATH` at a writable folder. Packages appear in `packages/`.

`frida/*-play.js` remain individually usable for diagnostics. From the repository root, with an intended unfinished Zip board open:

```sh
frida -U -N com.linkedin.LinkedIn \
  -l frida/zip-play.js \
  -o zip-fast-play.log
```

Then run `playZip()` once; `stopZipPlayer()` cancels. Other adapters start automatically and provide their existing stop/inspect commands. End the native tweak session before running standalone Frida players, so only one player controls the board.

`Tweak.m` contains the loader, `scripts/bundle.cjs` embeds the page functions, and `scripts/test.cjs` runs all local checks. Fixtures contain puzzle data only. Release archives exclude build caches, IPAs, extracted app code and account logs.
