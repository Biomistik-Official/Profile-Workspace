# Profile Workspace 2.2.0

Delivered the user-requested native engine integration while preserving existing accounts, plus shared bookmarks, dark Vesper, DuckDuckGo and the actual Windows application icon. The user explicitly authorized local installation and GitHub publication.

## Behavior

- New UI profiles select Camoufox by default, using the pinned0.5.9 launcher and its paired Firefox 158.0.1-beta.41. Legacy profiles remain Chromium; in-place engine conversion is rejected. No existing account was migrated automatically.
- Native identity values persist between launches. Language and timezone are editable; page/iframe/worker signals use the native engine. WebRTC and HTTP/3 are disabled, proxy failure does not select direct networking, and authenticated SOCKS uses the existing private bridge.
- Shared links are managed in Settings. Chromium retains Sites; native Firefox receives the same catalog in the Profile Workspace toolbar folder on launch. Personal native bookmarks outside it remain individual. Existing profile start URLs are retained, while address-bar search/new tabs use DuckDuckGo.
- Native browser chrome is dark Vesper, with profile identification in the tab strip. The manager retains the fluid navigation/panels delivered locally in 2.1.0. Native PNG, multi-size ICO, executable and live titlebar all use Vesper peach.
- Native profiles have independent persistent Firefox directories. Cookie operations route to their own backend; encrypted session snapshots distinguish imports awaiting launch from restart restoration. Pending writes and worker operations block destructive mutations. Timeout cleanup retains ownership until confirmed stop.

The application keeps Electron as the manager; browser execution can now use a separate native Camoufox process. Camoufox is installed separately through Settings rather than bundled into the installer. A private runtime owns product search/bookmark policies; the upstream Camoufox cache policy is unchanged. MIT UA-parser 1.0.41 is pinned for the SDK's two compatible parse calls, avoiding its AGPL 2.x dependency. Notices are retained under third-party/.

## Verification

- Build and NSIS packaging passed. `npm test`: 33 passed. Complete development Electron suite: 30 passed.
- Packaged manager/legacy UI, proxy, storage, OAuth, Sites and quit suite: 29 passed.
- Final packaged native suite: 3 passed, including actual Firefox identity stability, cookies/session cookies/Local Storage across app restart, restore toggling, pending imports, delayed encryption blocking edit/delete, OS window close, isolation, authenticated SOCKS with remote DNS and concurrent starts.
- Native bookmark presence was read from isolated places.sqlite; actual DuckDuckGo selection was read from Firefox's mozLz4 settings. Dark color-scheme was measured on the local fixture. These are synthetic local-site tests, not real provider-account acceptance tests.
- Packaged utility-process ESM loading and engine READY verified. Windows executable icon extraction and the running manager's WM_GETICON both returned peach #FFC799. Independent source review completed; reported lifecycle/policy/save races were fixed and covered where applicable.
- Dependency audit: 0 vulnerabilities. Staged source and publication inventory scanned for secrets, unsafe sinks and private data. `git diff --cached --check` passed after normalizing copied notice whitespace. No clean Windows machine or universal anti-detection claim.

## Account preservation and installation

Before installation the installed 2.1.0 manager closed normally. Complete offline backup: `%USERPROFILE%\Documents\Profile Workspace Backups\2026-11-11-before-camoufox\userData`. All 34,454 files were individually SHA256-verified. A Windows MAX_PATH copy failure was resolved by resuming with extended-length paths; originals were never removed or modified by backup.

Installer: `Profile-Workspace-Setup-2.2.0.exe`, 130,910,621 bytes. SHA256: `2FE2BF5DE71EF9DA1AEDE960EE22C141639641142E386B2647A59458897B93AF`.

Installer exit 0; installed product version 2.2.0.0. Installed ASAR matches the tested package: `AC4F95D351BDFF590E02EFC664FE3A0AFD4473EC46AAE35EA263DFAA13B0C5FE`. Manager reopened and responds. After startup, 15 profiles, 6 proxies and 6 shared bookmarks remain. All 511 checked account metadata/session/cookie/Local Storage/IndexedDB/Session Storage files match the offline backup; workspace.json is byte-identical. No real account cookies or credentials were exported or published.

The release includes source, installer, update blockmap/latest.yml and SHA256 checksums. Browser profiles, backups, engine/model cache, credentials and unrelated landing/ work are excluded. Actual account sessions can still be revoked by providers, and abrupt OS/browser loss can lose native changes since the latest capture.
