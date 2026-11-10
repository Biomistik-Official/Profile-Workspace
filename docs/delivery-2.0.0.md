# Profile Workspace 2.0.0

Implemented the approved graphite/teal preview on the 0.1.5 baseline (bce5025).

- Natural numeric name and tag ordering.
- Existing tags can be toggled in new/edit/bulk forms; custom entry remains available.
- Full notes wrap under profile names without hovering or truncation. Runtime errors are separate. Virtualized rows measure their content and grow as needed.
- Explicit launch/stop buttons, consistent surfaces, readable metadata, right-side profile editor, lightweight panel/dialog/toast transitions and reduced-motion support.
- Removed 0.1.6–0.1.7 fingerprint generation, settings, IPC and native overrides. Existing profile partitions and cookie handling retain 0.1.5 behavior.

## Evidence

- `npm run build`: passed.
- `npm test`: 25 passed.
- `npm run test:e2e`: 24 passed, including numeric/mixed names, tag create/edit/bulk persistence, real failed-proxy error alongside a full multiline note and viewport boundaries at 900/1024/1360/1440/1599/1600/1920px.
- Packaged executable: 11 tests passed (workspace UI, proxies, OAuth and safe update quit). Packaged version 2.0.0 verified. No compiled fingerprint implementation modules included; Lucide's unrelated icon files remain.
- Running UI inspected using fictional test data: [profiles](design/workspace-2-profiles.png), [editor](design/workspace-2-editor.png), [compact](design/workspace-2-compact.png). Compact root/table widths match the viewport and full notes fit measured boxes. Reduced-motion media verified.
- Independent review raised a possible 1600px overflow. Actual measurements and the retained boundary test disproved the arithmetic behind that finding; no unresolved blocker.
- `git diff --check`: passed.

## Local installation

The prior installed app closed normally through its window, allowing session persistence. A full backup was made outside the repository and verified: 22,654 files, matching total bytes and workspace metadata SHA-256. No force termination was needed.

Built `release/Profile-Workspace-Setup-2.0.0.exe` (124,192,663 bytes). SHA-256: `C87839CD8B978C4B77E9C6978C68C88A75F4EA90E289A06A7A7BF59525DBDD2C`.

The local installer exited with code 0. Installed `resources/app.asar` matches the tested packaged payload by SHA-256. The installed app was launched and has one visible responding manager window. After upgrade and launch, workspace.json remains byte-for-byte identical to the backup, with 12 profiles and 6 proxies.

At local installation time no GitHub publication, push or commit had been performed. The user subsequently authorized publication of this source and the same verified installer as v2.0.0. Production provider logins were not exercised; automated session/proxy/OAuth checks use synthetic data.

Design process: UI/UX Pro Max and unslop by Damir Sokolovsky (@heydamir), CC BY 4.0.
