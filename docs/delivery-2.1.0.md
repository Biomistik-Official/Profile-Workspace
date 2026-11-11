# Profile Workspace 2.1.0

Installed locally with Vesper as the default theme and a focused pass on everyday interaction. The user prioritized preserving accounts and existing logins.

## Delivered

- Vesper background, neutral surfaces, peach primary actions, mint running/success states and red errors, including manager and browser chrome. Source attribution and reference license are in `third-party/`.
- Interruptible crossfades between manager sections and profile tabs; Ctrl+K focuses search after navigation commits.
- Profile details overlay the workspace without collapsing navigation or resizing the table. Desktop table controls remain interactive; narrow layouts have a dismissing scrim.
- Shared entrance/exit rhythm for editors, group dialogs, cookie import preview and notifications. Closing dialogs are inert; reduced motion skips the exit delay. Focus returns to the connected opening control.
- Floating bulk actions keep table geometry stable. Full notes, numeric sorting, groups and tag buttons are retained.

The engine remains Electron 45.2.3. AppId, data directory, profile IDs, session partitions, encryption, proxy routing and cookie storage are unchanged. No Donut code was copied. No commit, push or GitHub publication was performed. Unrelated `landing/` work was left untouched.

## Verification

- `npm run build` and `npm run dist`: passed.
- `npm test`: 27 passed.
- Complete development Electron suite: 29 passed.
- Packaged executable: 28 scenarios passed across UI, sessions/restarts, OAuth, proxy routing, Sites and safe update quit. The first packaged invocation omitted `PROFILE_WORKSPACE_TEST_VERSION`, so three proxy cases failed their old-version precondition (expected 0.1.2, actual 2.1.0). Re-running those three with the correct version passed; no production change was required.
- RED→GREEN regressions covered sidebar collapse, immediate editor removal, Ctrl+K focus scheduling and cookie-preview exit. Rapid navigation, reduced motion and keyboard dismissal also passed.
- Existing geometry regression passed at 900, 1024, 1360, 1440, 1599, 1600 and 1920px. Fictional-data screenshots were visually inspected: [profiles](design/workspace-vesper-profiles.png), [editor](design/workspace-vesper-editor.png).
- Independent source review and follow-up found no remaining blockers. `git diff --check` passed.

## Installation and account data

The previous application closed normally through its window before backup. Complete offline backup: `%USERPROFILE%\Documents\Profile Workspace Backups\2026-11-11-before-ui-polish\userData`. All 34,440 copied files were verified individually against their source SHA256 values; total size 5,213,112,910 bytes. The sibling `manifest.json` records the hashes. The backup contains private browser data and is outside the repository.

Installer: `release/Profile-Workspace-Setup-2.1.0.exe`, 124,194,834 bytes. SHA256: `826DB998620E5B50CE72A992A03C93CE8314A3FBFEA6BDEB2B353EB98E1A575F`.

The installer exited 0. Installed `resources/app.asar` exactly matches the tested packaged payload: `D7124D2913E5CC2BC87EBB3BE005CAAA884E1617A07E7269FDBB83A07AEAE566`. Installed product version is 2.1.0.0; the manager is open and responding.

After installation and manager startup, all 15 profiles and 6 proxies remain. workspace.json is byte-identical to the backup. Hash checks of 511 account-data files (metadata, encrypted session snapshots, profile cookies, Local Storage, IndexedDB and Session Storage) found zero changes. Actual provider-account logins were not exercised; automated login/session checks use synthetic local fixtures.
