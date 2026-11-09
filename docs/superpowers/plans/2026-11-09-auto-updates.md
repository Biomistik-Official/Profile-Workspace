# Automatic Updates Implementation Plan

**Goal:** Installed Windows app downloads GitHub releases and applies them after safe shutdown.
**Architecture:** Small injected update controller, manager-only IPC, Settings status, NSIS release assets.
**Tech stack:** Electron 45, electron-builder 26.18, electron-updater 6.8.11, React/TypeScript.
**Spec:** ../specs/2026-11-09-auto-updates-design.md

## Global constraints
Preserve appId and userData. No forced restart or user credentials in feed. Disable updates in portable/dev/test instances. Use stable releases only. Installation runs on the actual quit event, after session persistence.

## Review focus
Offline failures/retry, overlapping checks, downloaded update state, rejected session-save shutdown, release hash/version mismatch.

## Tasks
- [x] Add tests/unit/updates.test.ts with injected EventEmitter updater: disabled instance, configuration, deduplicated checks, progress, ready state, failed check retry. Observe RED; implement electron/updates.ts and shared UpdateState; verify GREEN.
- [x] Wire main/preload manager-only checkUpdates and closeToUpdate. Include state in snapshots. Start delayed/periodic checks with unref timers and disable in isolated instances. Add Settings UI and integration check for disabled development mode. Verify build and unit/Electron suites.
- [x] Configure per-user NSIS installer with existing appId, desktop/start-menu shortcuts and GitHub publish provider. Preserve portable as explicit secondary script. Bump 0.1.5 and document migration. Build installer and validate latest.yml digest.
- [x] Review complete diff and security boundaries; run packaged tests and install/launch smoke checks. Publish source and complete release assets, verify public metadata.

## Execution ledger
User approved installed distribution in chat. Execute inline in the existing clean branch; prior fixes are already committed/published in 0.1.4. No isolated worktree is needed for this single active task. Installer implementation uses library actual quit hook rather than quitAndInstall, preserving existing asynchronous session-save cancellation.

Controller: four failing behavior tests observed, implemented and passing. Build, 24 unit tests, 19 prior Electron tests and new safe-quit regression passed. Packaged OAuth/sites/quit tests passed. Reviewer found no consequential code issues; requested installer and safe-quit validation, both completed. NSIS installed successfully on this PC; real data migration retained existing profiles and proxies. Manifest SHA512/size/version verified. Release 0.1.5 published with installer, blockmap, latest.yml and checksums. Installed app successfully checked the production GitHub feed. All 20 Electron tests and 24 unit tests passed.
