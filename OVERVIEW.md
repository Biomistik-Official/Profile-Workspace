# Dolphin Anty REA

## Purpose and current state

Implemented Profile Workspace, a standalone Windows browser-profile manager. The user chose an independent implementation, then clarified that a one-to-one copy is unnecessary: use the product idea and improve the design with UI/UX Pro Max. Advertising and artificial profile limits are unwanted. Separate profiles, persistent sessions, per-profile proxies, tags, notes, bulk launch, and cookies are explicitly important. Full fingerprint functionality remains a separate research topic.

## Proposed product design

- [Design proposal](docs/superpowers/specs/2026-11-08-profile-workspace-design.md): approved by the user before implementation; scope, workflows, cookie semantics, launch queue, architecture boundaries, and acceptance criteria.
- [Static interface concept](docs/design/profile-workspace-concept.png): graphite desktop table and profile detail panel with teal accents; fictional data only. Visually inspected after rendering at 2880×1880. It does not demonstrate executable behavior.
- The brainstorming builder check found no important unanswered planning questions. This is a design review, not implementation verification.

The user approved the graphite/teal concept. UI/UX Pro Max's Minimalism & Swiss Style and bulk-selection guidance fit; its marketing-page layout suggestions did not fit and were discarded. [Running interface screenshot](docs/design/profile-workspace-running.png) uses fictional data in an isolated temporary workspace.

## Architecture and entry points

- `electron/main.ts`: lifecycle, trusted IPC, profile/session ownership, Windows safeStorage, native dialogs, cookie import/export and proxy probes.
- `electron/socks-bridge.ts`: per-session loopback HTTP bridge through authenticated SOCKS5, using pinned CommonJS proxy-chain 2.7.1. Random local credentials restrict bridge access; remote hostname resolution uses socks5h. Main closes bridges on check completion, failed/cancelled launches, browser close, reconfiguration and shutdown.
- `electron/browser.ts`: profile browser windows and unprivileged WebContentsView tabs. Each remote view sets `disable_non_proxied_udp`.
- `src/components/SitesPanel.tsx`: left slide-out site shortcuts inside each profile browser, toggled by the top-left Sites button. Links open new tabs in the current profile session; native views move right by 300 px while the panel is open. Custom links are shared across profiles and saved atomically in `workspace.json`; old workspaces receive Twitch, TikTok, YouTube, Instagram and Supercell Creators defaults. Browser-only IPC validates the shell sender/frame and HTTP(S) URLs.
- `core/fingerprint.ts`, `electron/fingerprint.ts`: validated persistent per-profile browser parameters and native CDP overrides for language/locale, timezone, screen, logical CPU count and optional User-Agent. Fresh tabs initialize an internal blank renderer before applying overrides and navigating; OAuth child tabs adopt Chromium contents and receive overrides asynchronously. Native User-Agent Client Hints are read from the trusted local browser shell. Defaults follow the actual Chromium version. Legacy profiles are migrated atomically on open; duplicates get fresh generated parameters. The form supports editing/regeneration while stopped. Since 0.1.7 only Russian/English language families are accepted/generated; valid older foreign languages migrate atomically to en-US without changing other parameters. Canvas/WebGL/Audio/fonts/workers remain native; no guarantee of fingerprint uniqueness or login-block removal.
- `electron/updates.ts`: injected update state controller using electron-updater 6.8.11. Installed Windows builds check stable GitHub releases after 15 seconds and every six hours, auto-download and install on actual quit; no forced restart. Existing before-quit session persistence can cancel shutdown. Manager-only IPC exposes checking and normal quit after download; Settings displays status/progress. Portable/development/PROFILE_WORKSPACE_DATA_DIR instances are disabled. NSIS per-user installer retains appId and userData, publishes installer/blockmap/latest.yml.
- `electron/preload.ts`: allowlisted renderer bridge; main enforces manager-only versus browser-only calls by sender and frame identity.
- `electron/cookie-service.ts`: cookie conversion, replace/merge with rollback on browser rejection.
- `core/store.ts`: serialized mutations and atomic JSON replacement; secrets enter through an injected encryption codec. Public snapshots omit encrypted password payloads.
- `core/cookies.ts`, `core/validation.ts`: JSON/Netscape exchange and validation. Unsupported partition keys are rejected explicitly.
- `core/queue.ts`: deduplicated, cancellable start queue with concurrency and interval controls.
- `src/App.tsx`, `src/components/`, `src/styles.css`: React UI, virtualized profile table, detail panel, native-dialog-backed import workflow, forms and browser toolbar.
- `shared/types.ts`: runtime/renderer contracts. `package.json` points to compiled `dist-electron/electron/main.js`.

Data flow: manager UI → preload → sender-checked main handler → store/session/browser controller → snapshot event. Site pages have sandboxing and context isolation, no Node integration or privileged preload. Persistent partitions are named `persist:profile-<validated UUID>`, separate from `persist:workspace-ui`.

Saved session cookies are hydrated once through a cached promise before cookie reads, mutations, duplication and launch. Shutdown awaits and saves only successfully hydrated sessions; a failed hydration cannot overwrite its original encrypted snapshot. Actual save failure keeps the manager open for recovery.

## Reference research

The project was inspired by the workflow of Dolphin Anty. Read-only research on separate temporary copies informed the product design; no original executable, extracted implementation, user profile, cookie database or authentication token is included. This project uses its own Electron/React implementation and does not use Dolphin services.

## Data and known limits

Each profile owns its Chromium storage and proxy configuration. Persistent cookies and Local Storage survive restart; session-cookie restoration is an explicit per-profile option. Passwords and session snapshots use asynchronous Windows safeStorage. Metadata uses atomic JSON rather than SQLite. Duplication copies settings and cookies only; it does not copy Local Storage/IndexedDB. Cookie-only transfer cannot be assumed to preserve every site's login.

Authenticated SOCKS5 is supported starting with local version 0.1.1; passwords remain protected by Windows safeStorage, with SOCKS5 credentials limited to 255 UTF-8 bytes per field. See [NordVPN setup](docs/nordvpn-proxy.md). Live NordVPN account connectivity is unverified. Partitioned-cookie exchange, full fingerprint spoofing, extensions, cloud sync are not implemented. Engine updates ship with application updates; installed Windows builds support automatic GitHub updates starting with 0.1.5. Site camera/microphone/location/notification requests are currently denied. Proxy preflight and IP checks use ipify; failed checks never substitute direct access. See README for user-facing limitations, backup and import/export semantics.

## Commands and constraints

Version 0.1.6 verification: 27 unit tests and 22 Electron tests passed; four packaged parameter/UI/OAuth/safe-quit regressions passed. Production updater upgraded the installed 0.1.5 to 0.1.6, preserving profile metadata and proxy count. Generated profile parameters persisted across two installed-app launches. This verifies the first actual production update path.

Version 0.1.4 fixes `getTitle` errors from destroyed tab contents. Browser shutdown clears the tab map before native close events; state/layout prune destroyed views and reconcile the active tab. New unit regressions reproduce synchronous close events and externally destroyed tabs; the sites integration test also destroys an actual native tab before stopping the profile.

OAuth popups now use Electron's `createWindow` callback and adopt its supplied native WebContents into profile tabs. This preserves `window.opener`, sessionStorage, postMessage and script-initiated close across cross-origin redirects. Popup contents keep the current profile session, sandboxing and WebRTC policy without Node/preload privileges; only HTTP(S) and initial `about:blank` popups are accepted. `tests/e2e/oauth.spec.ts` covers the full local redirect/message/close flow, shared cookies, isolation and file-popup rejection. Live Twitch/Supercell account linking still requires user verification.

Version 0.1.3 adds the browser Sites drawer. Build, 18 unit tests and 18 real Electron integration/UI tests passed. The sites test covers new tabs, native-view bounds, persistence across shell reload, deletion and HTTP(S)-only navigation; store tests cover legacy data migration and preserving an empty site list.

Version 0.1.2 guards second-instance handling against shutdown and destroyed manager windows. `tests/e2e/lifecycle.spec.ts` reproduces the stale-window exception. An already-running older binary must be closed before launching the update; fixes in a downloaded binary cannot change its existing single-instance handler.

`npm ci` installs pinned dependencies. `npm run build` compiles Electron TypeScript and the Vite renderer; `npm start` runs the built app. `npm test` runs unit tests, `npm run test:e2e` runs real Electron/Playwright integration tests, `npm run dist` builds the per-user NSIS installer plus update manifest/blockmap; `npm run dist:portable` builds the manual portable executable. Node 22.22.2 was used. The HTTP proxy E2E requires outbound network access to ipify. The default user data directory is Electron's application userData path; `PROFILE_WORKSPACE_DATA_DIR` intentionally overrides it for isolated instances and tests.

Version 0.1.1 verification: build passed; 16 unit tests and 16 Electron integration/UI tests passed; full npm audit reported zero vulnerabilities. Three proxy tests also passed against the packaged 0.1.1 payload, with app.isPackaged verified. They cover authenticated SOCKS5 IP checks, real HTTP browser traffic, remote DNS, stop/restart and port closure, rejected credentials without direct access, and the existing authenticated HTTP path. Independent review found no consequential issues. Actual NordVPN connectivity requires the user's service credentials and remains unverified.

Earlier 0.1.0 verification: UI screenshots inspected at 1440×900 and 1024×768. Independent code review found four cookie/network issues; each was reproduced with a failing regression, fixed and verified. Normal-data app opened and desktop shortcut verified. Exact initial artifacts, hash, decisions and practical limitations are in [delivery report](docs/delivery-2026-11-08.md). Reference research remains static evidence; no proprietary reference code is included in the product.
