# LinkedWin

Automatically plays LinkedIn's Zip, Tango, Queens, Mini Sudoku, Patches, Wend, Crossclimb and Pinpoint games when you open them.

Requires iOS 17+, RootHide / Relaxin and tweak injection enabled for LinkedIn.

## Install

Download the `.deb` from [Releases](https://github.com/liamschwie/LinkedWin/releases), install it with your package manager, then fully close and reopen LinkedIn. Remove the old LinkedIn Games test package and stop Frida player sessions first.

Open a supported game to play automatically. Leave the game or background LinkedIn to cancel.

## Build

Requires [RootHide Theos](https://github.com/roothide/theos), Xcode, Node.js, ldid and Debian packaging tools.

```sh
export THEOS=/path/to/roothide-theos
node scripts/test.cjs
make clean package FINALPACKAGE=1
```

Packages are written to `packages/`.

**Beta:** Native loading and faster pacing still need phone testing. Unfinished Queens and completed/partial Zip handling remain unverified; Crossclimb's earlier post-win termination is unresolved.

[GPLv3](LICENSE).
