# Native Camoufox profiles and Vesper application icon

The user requested changing the browser engine, real anti-fingerprint features, and updating the native application icon. Preservation of existing accounts remains the primary constraint. They explicitly requested proceeding.

## Chosen approach

Keep Electron as the trusted profile manager and the existing Chromium backend for every legacy profile. Add Camoufox 0.5.9 with its paired Firefox build as a separate backend for newly created profiles. The public ShardBrowser and current Donut managers do not provide unrestricted open engine source; building a new Chromium fork is disproportionate to this iteration. Camoufox provides native configurable browser surfaces and an open engine.

Each Camoufox profile owns a persistent Firefox data directory and a private generated identity file. Do not point Firefox at Chromium partitions or change an existing profile's engine in place. Native settings cover navigator, screen, fonts and graphics, with language/timezone controls and WebRTC disabled. Do not claim all fingerprints are unique or any website will accept them. No JavaScript shim pretending to implement native spoofing.

A dedicated Electron utility process loads the ESM launcher and manages external browser contexts. Credentials travel through trusted process IPC, never command-line arguments. Engine setup/status is visible in Settings. Failures never fall back to direct networking or Chromium. Profile launch/stop/quit must include external browsers and release resources. Cookie operations target the correct backend; session snapshots use existing Windows encryption. Preserve legacy APIs and browser behavior.

Engine selection is explicit at creation and read-only afterwards. New profile UI selects Camoufox; old profiles without an engine field mean Chromium. Profile details clearly name the backend and actual implemented capabilities. The first delivery does not automatically transfer accounts between browser families. A saved identity is reused until the user deliberately creates a different profile; do not regenerate on every launch.

## Icon

Create an editable SVG matching the existing two-bar application mark, with Vesper peach fill and dark bars; render PNG and multi-size ICO from that vector. Use them in the native windows, packaged executable, installer and shortcuts. This is code-native vector artwork rather than a new AI-generated bitmap.

## Verification

Unit regressions: preserve legacy engine ownership, reject in-place conversion and invalid timezone/locale, retain fingerprint settings on metadata edits. Real Camoufox tests: persistent cookies/Local Storage across stop/restart, saved identity stability, native navigator/screen/timezone/locale in page/iframe/worker, isolation between profiles, proxy failure without fallback, cleanup. Existing Chromium suites stay green. Build and test packaged payload before installing; offline backup and post-install storage checks protect existing accounts.

## User steering and publication

The user additionally required the existing shared bookmarks in every session, dark theme and DuckDuckGo by default, and explicitly authorized completing work and publishing everything relevant to GitHub without more questions. Chromium keeps its Sites drawer and now searches via DuckDuckGo. Settings manages the shared catalog. Native Firefox receives the same bookmarks in a Profile Workspace toolbar folder on launch. The app owns a separate engine runtime and its policies rather than modifying the upstream Camoufox installation; policies add DuckDuckGo because stock Camoufox removes built-in search engines. Native chrome uses Vesper userChrome CSS and a dark content preference. Personal native bookmarks outside the managed folder are not replaced. This delivery does not implement cross-machine sync or an account migration wizard.
