# Installed Windows app with automatic updates

User selected an installed version with a shortcut instead of the portable executable. The existing app, profiles and `%APPDATA%/Profile Workspace` storage remain the same.

Use per-user NSIS and pinned electron-updater 6.8.11 with the existing public GitHub repository as its release feed. Check 15 seconds after startup and every six hours; download stable newer releases automatically. Install on actual application quit, after the existing asynchronous cookie/session shutdown succeeds. Never force a running profile to restart. A Settings card shows state, progress, manual checking and a Close and update action. Offline checks are nonfatal. No user tokens or new service are required.

Approaches: portable self-replacement requires a custom privileged executable replacement protocol; an NSIS install uses the maintained updater and is the user's selected approach. Keep portable build support as a secondary manual build, with updates explicitly unavailable there and in development/test instances.

Release 0.1.5 must publish its installer, blockmap and latest.yml only after tests/build checks. Maintain existing appId and userData path. No signing certificate is configured: use HTTPS GitHub distribution and updater SHA512 integrity validation, without claiming Authenticode signing.

Acceptance: UI updates; checks are deduplicated; errors allow retry; ready updates cannot be overwritten by subsequent checks; updater cannot close the app before normal session saving; installer and metadata agree on version/hash; isolated installer smoke test and packaged integration checks pass. A future live 0.1.5-to-newer production update remains a separate verification unless tested in an isolated fixture.
