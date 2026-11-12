# Local delivery: Profile Workspace 2.2.2 Academy

Delivered 2026-11-11 locally, without publishing or pushing. The external START.cmd now supports selected running Camoufox profiles through a manager-only, validated Academy bridge. Native sessions/proxies stay in their original owned persistent contexts.

## Evidence

- Build and installer completed; silent installation returned 0. Installed ASAR SHA256 equals release/win-unpacked/resources/app.asar.
- Installer SHA256: 0E0EA3468ED9FB1CDDDE8DF6B5726100BED9EC374B6B6E4724E85E583B95E270.
- 42 unit tests passed, 31 development Electron UI/IPC tests passed, 4 native tests passed.
- Packaged validation: 28 manager/legacy scenarios passed initially; three proxy scenarios initially failed only on the old default expected-version 0.1.2. With PROFILE_WORKSPACE_TEST_VERSION=2.2.2 the Academy IPC scenario and all three proxy scenarios passed. All 3 packaged native persistence/SOCKS/concurrency scenarios passed.
- 19 external runner tests passed. Installed CHECK discovered the running native profile and confirmed the bridge.
- Real Supercell read-only analysis through the installed app: 24 questions, 0 unresolved. Account quiz/XP submission was not part of this read-only check.

## Preservation

Before installation, the installed 2.2.1 main window was closed normally; no native browsers were running. Its background process remained stuck after the window closed and was terminated only after complete backup. Backup at C:/Users/Biomistik/Documents/Codex/backups/profile-workspace-academy-20261111 contains 73,427 copied files (zero failures) plus previous app.asar and a protected-file manifest.

After installation, before opening native profiles, all 231 protected files (including account databases, keys, identity files, encrypted snapshots and workspace metadata) matched the manifest. All 29 profiles and 6 proxies remained. Opening profile 2 for the live readiness check subsequently caused normal browser writes.

## Limits

The full three-quiz, saved-grade skip, XP claim, unknown-bank and hung-tab cases were tested in real Camoufox against intercepted fixture pages. This is distinct from completing every real account. Login is manual; unknown future questions and unavailable seasonal rewards stop explicitly. Viewing two videos remains outside the automation. Player-source inspection confirmed playback-rate support and watched-section tracking; skipping to the end is not established as a valid completion method.

## Live account validation and handoff

User authorized profiles 16, 17 and 18. All three completed the three selected quizzes with persisted A+. Profiles 17 and 18 confirmed both XP rewards; profile 16 stopped at claiming and remains unverified for XP. Live results are saved in the external runner's ignored live-camoufox-16-18.json. No video task was implemented.

A desktop shortcut named «Квизы Supercell» points to the existing START.cmd. A concise Russian КАК ПОЛЬЗОВАТЬСЯ.txt is next to the launcher. Installation version and shortcut target were rechecked. The targeted selection/native/preflight tests were rerun for handoff; the separate launcher UI test timed out in this session and was cancelled, so no fresh launcher UI success is claimed.
