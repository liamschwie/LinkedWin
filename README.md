# LinkedWin

Automatically plays LinkedIn's Zip, Tango, Queens, Mini Sudoku, Patches, Wend, Crossclimb and Pinpoint games when you open them.

Requires iOS 17+, RootHide / Relaxin and tweak injection enabled for LinkedIn.

## Install

Download the **rootless** `.deb` from [Releases](https://github.com/liamschwie/LinkedWin/releases). On RootHide / Relaxin, convert it with **RootHide Patcher**, then install the converted package and fully close and reopen LinkedIn. Remove the old LinkedIn Games test package and stop Frida player sessions first.

Open a supported game to play automatically. Leave the game or background LinkedIn to cancel.

## Build

Requires [Theos](https://theos.dev/docs/installation), Xcode, Node.js, ldid and Debian packaging tools.

```sh
export THEOS=/path/to/theos
node scripts/test.cjs
make clean package FINALPACKAGE=1
```

Packages are written to `packages/`. The default is rootless (`iphoneos-arm64`), for conversion with RootHide Patcher.

For a native RootHide package, use [RootHide Theos](https://github.com/roothide/theos) with `make clean package FINALPACKAGE=1 THEOS_PACKAGE_SCHEME=roothide`; install that package directly without Patcher.

**Beta:** Native loading and faster pacing still need phone testing. Unfinished Queens and completed/partial Zip handling remain unverified; Crossclimb's earlier post-win termination is unresolved.

[GPLv3](LICENSE).
