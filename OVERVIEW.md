# Dolphin Anty REA

## Purpose and current state

Implemented Profile Workspace, a standalone Windows browser-profile manager. The user chose an independent implementation, then clarified that a one-to-one copy is unnecessary: use the product idea and improve the design with UI/UX Pro Max. Advertising and artificial profile limits are unwanted. Separate profiles, persistent sessions, per-profile proxies, tags, notes, bulk launch, and cookies are explicitly important. Full fingerprint functionality remains a separate research topic.

## Proposed product design

- [Design proposal](docs/superpowers/specs/2026-11-08-profile-workspace-design.md): approved by the user before implementation; scope, workflows, cookie semantics, launch queue, architecture boundaries, and acceptance criteria.
- [Static interface concept](docs/design/profile-workspace-concept.png): graphite desktop table and profile detail panel with teal accents; fictional data only. Visually inspected after rendering at 2880×1880. It does not demonstrate executable behavior.
- The brainstorming builder check found no important unanswered planning questions. This is a design review, not implementation verification.

The user approved the graphite/teal concept. UI/UX Pro Max's Minimalism & Swiss Style and bulk-selection guidance fit; its marketing-page layout suggestions did not fit and were discarded. [Running interface screenshot](docs/design/profile-workspace-running.png) uses fictional data in an isolated temporary workspace.

## Version 2.2.2 — local Creator Academy automation

The external `Supercell Creators/quiz-automation/START.cmd` can select any number of running Camoufox profiles. The manager's new `workspace.academy` bridge accepts only validated profile IDs, fixed analyze/quiz/claim/cancel actions, the three approved course slugs, and optional operation UUIDs. `core/academy.ts` rejects arbitrary URL/script fields; the existing manager sender/frame guard remains mandatory. No general page execution or native browser endpoint is exposed to renderers.

`electron/academy/engine.mjs` operates a dedicated tab within the worker-owned persistent context, preserving profile/session/proxy ownership. It reads the entire delivered question bank before answering, checks all 24 known answers, uses trusted Playwright clicks, reloads successful courses to verify saved A+, and targets real XP buttons despite triplicated decorative labels. Successful exams are skipped rather than reopened. All selected accounts receive preflight checks before the runner submits answers. The bank is read in Camoufox's explicitly enabled main-world evaluation mode; normal DOM work remains isolated. This is an automation capability, not a fingerprint/device change or authentication bypass.

Each action has a 120-second deadline that actively closes only its Academy tab to interrupt hung website promises. UUID-scoped cancellation bypasses the per-profile operation queue and cannot cancel another profile's action. Ctrl+C in the native runner requests cancellation and waits for acknowledgment. Session capture and normal stop/quit retain their existing ownership locks. Unknown questions, login redirects, missing rewards and non-A+ results stop with an actionable error instead of claiming completion.

`scripts/copy-runtime.cjs` copies the ESM Academy modules; the directory is included in ASAR unpacking for the utility worker. `tests/native/academy.spec.ts` intercepts only the fixed site URLs in a disposable Camoufox context and verifies all three quizzes, saved-grade skipping, both reward claims, unknown-bank refusal, and interruption without losing account storage. Unit/controller and manager-IPC tests cover validation, serialization, cancellation and deadlines. Provider authentication is manual. The user subsequently authorized committing the source to main, with no Academy information in GitHub release notes.

## Version 2.2.1 — Google default search

The user requested returning Google. Chromium search/new tabs, new-profile defaults and the private Camoufox search policy now use Google. Store opening atomically migrates only exact DuckDuckGo home URLs (with/without trailing slash) in default settings/profile start pages; account IDs, other metadata and custom URLs remain intact. Existing bookmarks and native identity/session ownership remain unchanged. The native policy adds Google explicitly and removes the old managed DuckDuckGo/None engines. Real Firefox search settings are checked by the native regression.

## Version 2.2.0 — native Camoufox backend

New UI-created profiles default to Camoufox; legacy profiles without `engine` remain Chromium and cannot be converted in place. `core/store.ts` validates both loaded/submitted engine names and bounded native locale/timezone settings. There is no automatic migration of accounts, passwords or site storage between browser families.

`electron/camoufox.ts` owns a dedicated Electron utility process running `camoufox-worker.mjs`. Pinned Camoufox 0.5.9 uses Playwright-core 1.62.0; the independent development test runner retains its nested core. The only UA-parser SDK calls are getOS/getBrowser, verified with the MIT 1.0.41 override. `scripts/copy-runtime.cjs` copies the ESM entry points for the CommonJS Electron build. Browser resources and the Playwright driver are unpacked where needed; packaged utility startup is verified separately.

`electron/native-runtime.mjs` prepares an app-private engine under LOCALAPPDATA/Profile Workspace/Engines/camoufox-0.5.9. The paired engine is downloaded separately through Settings. Files initially share hard links with the Camoufox cache (copy fallback across filesystems); policy updates replace their inode, leaving the upstream policy untouched. Shared policy writes are serialized and use unique temporary files. DuckDuckGo is explicitly added as Camoufox's supplied policy otherwise removes standard search engines. Shared Sites become a Profile Workspace folder on every native toolbar at launch; personal bookmarks outside that folder stay per-profile. Native profile chrome uses `assets/firefox-userChrome.css`; pages receive dark color-scheme. The existing Chromium Sites drawer remains; its search and new-tab defaults are DuckDuckGo. Settings manages the common bookmark catalog.

Each native profile owns userData/camoufox/<UUID>/identity.json and browser/. Generated native identity configuration is reused, with deliberate language/timezone edits. Only device values are saved; environment/proxy credentials are excluded. Windows is the supported target OS. WebRTC, HTTP/3, DNS prefetch, DoH and direct proxy failover are disabled. HTTP/SOCKS routing is preflighted; authenticated SOCKS reuses the existing private loopback bridge. Geolocation is denied rather than spoofed. No guarantee of fingerprint uniqueness or account unlinkability is made.

Native cookie I/O uses the correct Firefox persistent context. Session snapshots live under camoufox-sessions/ with Windows encryption, distinguishing pending imports from restart restoration. Periodic/response captures cover native window close; managed Stop obtains a final snapshot. Async saves and RPC operations hold profile mutation locks, including after timeout until confirmed cleanup. Failed snapshots remain available for quit recovery. Sudden OS/browser termination can still lose changes after the last capture. Old Chromium sessions and encryption paths retain their earlier ownership.

The Vesper mark has an editable SVG, raster PNG and multi-size ICO; `scripts/render-icon.cjs` renders it in an isolated Electron instance. Native EXE extraction verifies peach #FFC799. Real native tests in `tests/native/` run with `playwright.native.config.ts`, including actual Firefox cookie/Local Storage persistence, native signals in page/iframe/worker, OS-window close, restore toggling/imports, shared bookmarks/real default search settings, authenticated SOCKS and concurrent launches. Run native suites serially because test workspaces share the app-private runtime policy.

Verification: 33 unit, 30 development Electron, 29 packaged manager/legacy and 3 packaged native scenarios passed. Installer applied locally; native EXE/live titlebar icon verified.15 profiles, 6 proxies and 6 shared bookmarks remain;511 account-storage files match the verified offline backup. [Delivery evidence](docs/delivery-2.2.0.md).

## Version 2.1.0 — Vesper and fluid interaction

The default palette follows the user-selected [Vesper reference](https://github.com/vladzima/vesper-theme): #101010 background, #FFC799 peach accent, #99FFE4 success, #FF8080 errors. `src/tokens.css` owns the palette; `src/fluid.css` adapts the existing manager and browser chrome. Attribution and the reference license are in `docs/third-party/`.

`src/ui-motion.ts` uses native View Transitions for manager navigation and profile tabs, with an immediate fallback and reduced-motion support. Revision checks make rapid input settle on the last destination; Ctrl+K focuses search after the committed update. `src/components/Presence.tsx` retains closing overlays for 160ms, explicitly makes top-layer dialogs inert during exit, and bypasses the delay under reduced motion. `Modal.tsx` returns focus to the original connected trigger when no other dialog is open.

Profile detail overlays keep navigation and table geometry stable. On desktop the underlying table remains interactive; below 1200px a dismissing scrim covers the content. Floating bulk actions avoid pushing the table down. Existing full notes, numeric sorting, group/tag behavior and profile actions remain. The browser engine, profile/session ownership, appId, encryption and data paths are unchanged; native window background colors match Vesper. Runtime regressions support both development and packaged executables via `PROFILE_WORKSPACE_TEST_EXECUTABLE`.

[Design](docs/superpowers/specs/2026-11-11-fluid-workspace-design.md), [plan](docs/superpowers/plans/2026-11-11-fluid-workspace.md), [profiles](docs/design/workspace-vesper-profiles.png), [editor](docs/design/workspace-vesper-editor.png). Account preservation is the primary constraint; changing to a different browser engine remains a separate compatibility project.

Verification: build, 27 unit tests, 29 development Electron tests and 28 packaged scenarios passed. Installed 2.1.0 locally; installed ASAR matches the tested payload. Complete offline backup contains 34,440 individually hash-verified files. After installation/startup, 15 profiles and 6 proxies remain, workspace.json is byte-identical and 511 account-storage files match the backup. Real provider logins were not exercised. See [delivery report](docs/delivery-2.1.0.md).

## Version 2.0.1

Groups have an independent persistent `groups: string[]` catalog in `workspace.json`. `WorkspaceStore.open` merges legacy profile tags into the catalog; profile saves and bulk edits register new tags without removing unused groups. `saveGroup` creates or renames a group and updates all assigned profile tags atomically; `deleteGroup` removes the catalog entry and assignments while retaining profiles and browser data. Names follow the tag length limit (40 characters); the editor rejects commas to stay compatible with comma-separated tag inputs. Existing exact-name tag identity and per-profile 30-tag limits remain unchanged.

`src/components/GroupsPage.tsx` adds the Groups navigation page with create/rename dialogs, counts, profile filtering and confirmed deletion. Sidebar filters and create/edit/bulk tag pickers include empty catalog groups. No group-specific IPC accesses browser sessions or proxy credentials; manager-only sender validation applies. Store regressions cover legacy migration, persistence after removing assignments/deleting profiles, validation, rename and delete. The Electron UI regression exercises creating an empty group, selecting it in a profile form, renaming it, removing its last assignment, reloading and deleting the group while retaining the profile.

Verification: build, all 27 unit tests and all 25 Electron tests passed. Both group-editor and create/edit/bulk tag-picker regressions also passed against `release/win-unpacked/Profile Workspace.exe`. [Groups screenshot](docs/design/workspace-2.0.1-groups.png) uses isolated test data. Release artifacts are the NSIS installer, blockmap, `latest.yml` and SHA256 checksums. Publication of v2.0.1 was explicitly requested; no local installation was performed.

## Version 2.0.0

The user approved the imagegen direction and requested implementation with always-visible notes and light animations. [Approved design](docs/superpowers/specs/2026-11-10-workspace-2-design.md), [implementation ledger](docs/superpowers/plans/2026-11-10-workspace-2.md), [running UI](docs/design/workspace-2-profiles.png), [editor](docs/design/workspace-2-editor.png).

Behavior returns to 0.1.5 (bce5025): the generated fingerprint settings, renderer IPC and native overrides from 0.1.6/0.1.7 are removed. Existing workspace JSON can retain obsolete fingerprint fields; loading no longer validates, generates or migrates them, and they do not affect browsing. Profile IDs, storage partitions and cookies keep their previous ownership.

The UI uses numeric-aware Russian collation for profile names and the tag catalog. `src/components/TagPicker.tsx` provides existing-tag toggle buttons in create/edit/bulk forms, retaining custom comma-separated entry. Bulk tags still replace current tags when nonempty. Profile rows are measured by the virtualizer with a 76px minimum; the full note wraps under its name, errors appear separately, and row actions remain visible. `src/design-v2.css` applies graphite/teal tokens, responsive layout and short opacity/transform transitions with reduced-motion support. Browser shell heights/native content bounds stay unchanged.

## Architecture and entry points

- `electron/main.ts`: lifecycle, trusted IPC, profile/session ownership, Windows safeStorage, native dialogs, cookie import/export and proxy probes.
- `electron/socks-bridge.ts`: per-session loopback HTTP bridge through authenticated SOCKS5, using pinned CommonJS proxy-chain 2.7.1. Random local credentials restrict bridge access; remote hostname resolution uses socks5h. Main closes bridges on check completion, failed/cancelled launches, browser close, reconfiguration and shutdown.
- `electron/browser.ts`: profile browser windows and unprivileged WebContentsView tabs. Each remote view sets `disable_non_proxied_udp`.
- `src/components/SitesPanel.tsx`: left slide-out site shortcuts inside each profile browser, toggled by the top-left Sites button. Links open new tabs in the current profile session; native views move right by 300 px while the panel is open. Custom links are shared across profiles and saved atomically in `workspace.json`; old workspaces receive Twitch, TikTok, YouTube, Instagram and Supercell Creators defaults. Browser-only IPC validates the shell sender/frame and HTTP(S) URLs.
- `electron/updates.ts`: injected update state controller using electron-updater 6.8.11. Installed Windows builds check stable GitHub releases after 15 seconds and every six hours, auto-download and install on actual quit; no forced restart. Existing before-quit session persistence can cancel shutdown. Manager-only IPC exposes checking and normal quit after download; Settings displays status/progress. Portable/development/PROFILE_WORKSPACE_DATA_DIR instances are disabled. NSIS per-user installer retains appId and userData, publishes installer/blockmap/latest.yml.
- `electron/preload.ts`: allowlisted renderer bridge; main enforces manager-only versus browser-only calls by sender and frame identity.
- `electron/cookie-service.ts`: cookie conversion, replace/merge with rollback on browser rejection.
- `core/store.ts`: serialized mutations and atomic JSON replacement; secrets enter through an injected encryption codec. Public snapshots omit encrypted password payloads.
- `core/cookies.ts`, `core/validation.ts`: JSON/Netscape exchange and validation. Unsupported partition keys are rejected explicitly.
- `core/queue.ts`: deduplicated, cancellable start queue with concurrency and interval controls.
- `src/App.tsx`, `src/components/`, `src/styles.css`, `src/design-v2.css`: React UI, virtualized profile table, detail panel, native-dialog-backed import workflow, forms and browser toolbar.
- `shared/types.ts`: runtime/renderer contracts. `package.json` points to compiled `dist-electron/electron/main.js`.

Data flow: manager UI → preload → sender-checked main handler → store/session/browser controller → snapshot event. Site pages have sandboxing and context isolation, no Node integration or privileged preload. Persistent partitions are named `persist:profile-<validated UUID>`, separate from `persist:workspace-ui`.

Saved session cookies are hydrated once through a cached promise before cookie reads, mutations, duplication and launch. Shutdown awaits and saves only successfully hydrated sessions; a failed hydration cannot overwrite its original encrypted snapshot. Actual save failure keeps the manager open for recovery.

## Reference research

The project was inspired by the workflow of Dolphin Anty. Read-only research on separate temporary copies informed the product design; no original executable, extracted implementation, user profile, cookie database or authentication token is included. This project uses its own Electron/React implementation and does not use Dolphin services.

## Data and known limits

Each profile owns its Chromium storage and proxy configuration. Persistent cookies and Local Storage survive restart; session-cookie restoration is an explicit per-profile option. Passwords and session snapshots use asynchronous Windows safeStorage. Metadata uses atomic JSON rather than SQLite. Duplication copies settings and cookies only; it does not copy Local Storage/IndexedDB. Cookie-only transfer cannot be assumed to preserve every site's login.

Authenticated SOCKS5 is supported starting with local version 0.1.1; passwords remain protected by Windows safeStorage, with SOCKS5 credentials limited to 255 UTF-8 bytes per field. See [NordVPN setup](docs/nordvpn-proxy.md). Live NordVPN account connectivity is unverified. Cookie-Editor 1.13.0 is bundled and loaded automatically in every Camoufox profile; it is available from the extensions panel and the sidebar. Its add-on files live beside the app and are copied into the app data folder without touching profile cookies. Arbitrary user-installed extensions remain unsupported, and Chromium profiles do not load Cookie-Editor because Electron does not implement `chrome.cookies`. Partitioned-cookie exchange, full fingerprint spoofing, cloud sync are not implemented. Engine updates ship with application updates; installed Windows builds support automatic GitHub updates starting with 0.1.5. Site camera/microphone/location/notification requests are currently denied. Proxy preflight and IP checks use ipify; failed checks never substitute direct access. See README for user-facing limitations, backup and import/export semantics.

## Commands and constraints

Version 2.0.0: build, 25 unit tests, 24 Electron tests and 11 packaged tests passed. Local installer built and applied; installed payload matches the verified package. Full user-data backup verified before installation; workspace metadata remained byte-identical after upgrade/launch (12 profiles, 6 proxies). GitHub publication was subsequently authorized for v2.0.0. See [delivery report](docs/delivery-2.0.0.md). Earlier verification below describes historical releases.

Version 0.1.7 restricts profile languages to Russian/English. 29 unit tests and 22 Electron tests passed; both parameter/UI regressions passed in the packaged payload. The production updater applied 0.1.6 → 0.1.7; current profile languages match migration expectations and all unrelated metadata/parameters remained unchanged.

Version 0.1.6 verification: 27 unit tests and 22 Electron tests passed; four packaged parameter/UI/OAuth/safe-quit regressions passed. Production updater upgraded the installed 0.1.5 to 0.1.6, preserving profile metadata and proxy count. Generated profile parameters persisted across two installed-app launches. This verifies the first actual production update path.

Version 0.1.4 fixes `getTitle` errors from destroyed tab contents. Browser shutdown clears the tab map before native close events; state/layout prune destroyed views and reconcile the active tab. New unit regressions reproduce synchronous close events and externally destroyed tabs; the sites integration test also destroys an actual native tab before stopping the profile.

OAuth popups now use Electron's `createWindow` callback and adopt its supplied native WebContents into profile tabs. This preserves `window.opener`, sessionStorage, postMessage and script-initiated close across cross-origin redirects. Popup contents keep the current profile session, sandboxing and WebRTC policy without Node/preload privileges; only HTTP(S) and initial `about:blank` popups are accepted. `tests/e2e/oauth.spec.ts` covers the full local redirect/message/close flow, shared cookies, isolation and file-popup rejection. Live Twitch/Supercell account linking still requires user verification.

Version 0.1.3 adds the browser Sites drawer. Build, 18 unit tests and 18 real Electron integration/UI tests passed. The sites test covers new tabs, native-view bounds, persistence across shell reload, deletion and HTTP(S)-only navigation; store tests cover legacy data migration and preserving an empty site list.

Version 0.1.2 guards second-instance handling against shutdown and destroyed manager windows. `tests/e2e/lifecycle.spec.ts` reproduces the stale-window exception. An already-running older binary must be closed before launching the update; fixes in a downloaded binary cannot change its existing single-instance handler.

`npm ci` installs pinned dependencies. `npm run build` compiles Electron TypeScript and the Vite renderer; `npm start` runs the built app. `npm test` runs unit tests, `npm run test:e2e` runs real Electron/Playwright integration tests, `npm run dist` builds the per-user NSIS installer plus update manifest/blockmap; `npm run dist:portable` builds the manual portable executable. Node 22.22.2 was used. The HTTP proxy E2E requires outbound network access to ipify. The default user data directory is Electron's application userData path; `PROFILE_WORKSPACE_DATA_DIR` intentionally overrides it for isolated instances and tests.

Version 0.1.1 verification: build passed; 16 unit tests and 16 Electron integration/UI tests passed; full npm audit reported zero vulnerabilities. Three proxy tests also passed against the packaged 0.1.1 payload, with app.isPackaged verified. They cover authenticated SOCKS5 IP checks, real HTTP browser traffic, remote DNS, stop/restart and port closure, rejected credentials without direct access, and the existing authenticated HTTP path. Independent review found no consequential issues. Actual NordVPN connectivity requires the user's service credentials and remains unverified.

Earlier 0.1.0 verification: UI screenshots inspected at 1440×900 and 1024×768. Independent code review found four cookie/network issues; each was reproduced with a failing regression, fixed and verified. Normal-data app opened and desktop shortcut verified. Exact initial artifacts, hash, decisions and practical limitations are in [delivery report](docs/delivery-2026-11-08.md). Reference research remains static evidence; no proprietary reference code is included in the product.
