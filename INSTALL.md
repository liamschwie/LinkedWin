# Install LinkedWin

**0.2.0-beta1 — RootHide / Relaxin, iOS 17+**

1. End Frida player sessions. If the earlier **LinkedIn Games** beta is installed, remove it first; the package also declares a conflict to prevent both players loading together.
2. Transfer **LinkedWin_0.2.0-beta1_roothide.deb** to the phone and open it in your jailbreak's package manager.
3. Ensure your jailbreak allows tweak injection into **LinkedIn**, then fully close and reopen LinkedIn.
4. Open a supported game: **Zip, Tango, Queens, Mini Sudoku, Patches, Wend, Crossclimb or Pinpoint**. LinkedWin recognizes the page and starts when its board is ready. There is no Solve button.
5. Check the completed board and reopen it to verify the saved result. Start with one intended unfinished board; do not reset a completed daily game for testing.

This package is built for RootHide's `iphoneos-arm64e` package scheme. It is not a standard rootless package.

## Stop or remove

Leave the game or background LinkedIn to cancel playback. Return to the game list and reopen a board for a fresh session. To disable it completely, close LinkedIn and remove/disable **LinkedWin** through your jailbreak/package manager, then reopen LinkedIn.

## Before relying on the faster build

Pinpoint's original Frida submission is phone-confirmed. The native loader and faster pacing still need device testing. Zip handles active walls but fresh completed-board detection and arbitrary partial-path resumption are unverified. Queens has not yet been tested on an unfinished board. The earlier Crossclimb post-win termination remains unresolved.

Opening an unfinished board may start its clock. Recorded times include that time; this package does not spoof clocks or records.

See **Source/README.md** in the release ZIP (or **README.md** beside this file in the source folder) for the overview, and **Source/docs/DETAILS.md** (or **docs/DETAILS.md**) for speed changes, puzzle checks and verification limits. Native status logs use `[LinkedWin]`; diagnostic Frida logs can contain account data and should stay private.
