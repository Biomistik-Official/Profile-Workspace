# Cookie-Editor in every Camoufox profile — design

## Intent

Every Camoufox profile should open with the Cookie-Editor extension already
available in the toolbar. Existing cookies, logins, Local Storage and the saved
native identity must survive unchanged.

## Goals

- Bundle the official Cookie-Editor Firefox build (v1.13.0, GPL-3.0) with the app.
- Provision it once into the app data folder, then load it for every Camoufox
  launch through Camoufox's `addons` option.
- Keep working offline; no first-run download.
- Prove with tests that the addon is provisioned and that profile cookies still
  survive a restart.

## Non-goals

- No extension store, per-profile extension manager, or enable/disable setting.
- No change to the Chromium engine. Electron does not implement `chrome.cookies`,
  so Cookie-Editor cannot function there. All current profiles are Camoufox.
- No automatic updates of the addon independent of app releases.
- No changes to cookie import/export, proxy, identity or session-cookie logic.

## Approaches considered

1. **Bundle and provision (chosen).** Ship the extracted Firefox addon in
   `assets/extensions/cookie-editor-firefox`, copy it to
   `<userData>/extensions/cookie-editor-firefox` when the app launches the native
   engine, and pass the absolute folder path as `addons[0]`. Offline, pinned,
   reproducible; adds ~0.9 MB to the build.
2. **Download at first launch.** Smaller installer, but requires network, adds a
   supply-chain surface, and fails behind a proxy/captive portal.

## Design

- `electron/extension-runtime.mjs` owns provisioning:
  `ensureCookieEditor(root, source?) -> Promise<string | undefined>`.
  It compares `manifest.json` versions, copies atomically into
  `<root>/extensions/cookie-editor-firefox`, and returns the absolute path.
  Failures return `undefined` instead of blocking a browser launch.
- `electron/camoufox-worker.mjs` calls it in `openContext` and adds
  `addons: [path]` to `launchOptions`. Camoufox installs it as a temporary
  add-on, so it appears in the extensions panel and sidebar while
  `cookies.sqlite`, `localstore`, `places.sqlite` and `identity.json` are
  untouched.
- `scripts/copy-runtime.cjs` copies the new ESM module into `dist-electron`.
- `package.json` unpacks `assets/extensions/**` from ASAR so the external Firefox
  process can read real files.
- Provenance and GPL-3.0 text live beside the addon.

## Constraints

- Windows target, Camoufox 0.5.9, Electron 45.
- Never let a missing/broken addon stop a profile from opening.
- Keep cookie/session ownership and encryption exactly as they are.

## Verification

- Unit test provisioning into a temporary root, including version replacement
  and missing-source fallback.
- Live Camoufox check: the add-on's gecko ID
  `{c3c10168-4186-445c-9c5b-63f12b8e2c87}` appears in the profile's
  `extension-preferences.json`, its `moz-extension` storage directory is created,
  and a persistent cookie still exists after a restart with the add-on enabled.
- Native test assertion: after a Camoufox profile launches, Cookie-Editor is
  registered in `extension-preferences.json`; the existing restart assertions
  still prove cookies survive.
