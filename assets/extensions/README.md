# Bundled browser extensions

## cookie-editor-firefox

- Project: [Moustachauve/cookie-editor](https://github.com/Moustachauve/cookie-editor)
- Release: `v1.13.0`
- Asset: `cookie-editor-firefox-1.13.0.zip` (extracted, not repacked)
- License: GNU GPL v3.0 — see `cookie-editor-firefox/LICENSE`
- Gecko add-on ID: `{c3c10168-4186-445c-9c5b-63f12b8e2c87}`

Profile Workspace copies this folder into `<userData>/extensions/` and passes it
to Camoufox through the `addons` launch option. The original release archive is
left untouched; replacing the add-on means dropping a newer extracted release
here so the `version` in `manifest.json` changes.

The Chrome/Edge builds are intentionally not bundled: Electron does not implement
`chrome.cookies`, so Cookie-Editor cannot edit cookies in the Chromium engine.
