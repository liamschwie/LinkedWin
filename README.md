# LinkedWin

Automatically plays LinkedIn's Zip, Tango, Queens, Mini Sudoku, Patches, Wend, Crossclimb and Pinpoint games when you open them.

Requires iOS 17+, RootHide / Relaxin and tweak injection enabled for LinkedIn.

## Install

Download the **rootless** `.deb` from [Releases](https://github.com/liamschwie/LinkedWin/releases). On RootHide / Relaxin, convert it with **RootHide Patcher**, then install the converted package and fully close and reopen LinkedIn. Remove the old LinkedIn Games test package and stop Frida player sessions first.

Open a supported game to play automatically. Leave the game or background LinkedIn to cancel.

Each player waits at least 3.25 seconds from its first input before finishing, without changing the game's timer. This is a provisional workaround for fast-save failures; a server minimum has not been confirmed.

## Build

Requires [Theos](https://theos.dev/docs/installation), Xcode, Node.js, ldid and Debian packaging tools.

```sh
export THEOS=/path/to/theos
node scripts/test.cjs
make clean package FINALPACKAGE=1
```

Packages are written to `packages/`. The default is rootless (`iphoneos-arm64`), for conversion with RootHide Patcher.

For a native RootHide package, use [RootHide Theos](https://github.com/roothide/theos) with `make clean package FINALPACKAGE=1 THEOS_PACKAGE_SCHEME=roothide`; install that package directly without Patcher.

**Beta:** Mini Sudoku and Wend need phone testing with the new timing guard. Patches making no moves is still under investigation. Unfinished Queens, partial Zip and Crossclimb's earlier post-win termination remain unverified.

For troubleshooting, `frida -U -N com.linkedin.LinkedIn -l frida/read-log.js` prints the tweak's local diagnostic log. It includes save status/errors and elapsed time, with account IDs and credentials redacted.

[GPLv3](LICENSE).
