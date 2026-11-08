# Profile Workspace 0.1.2 — second-instance lifecycle fix

The user reported `TypeError: Object has been destroyed` after downloading and opening the new executable. A stale 0.1.0 process was still the single-instance owner, with a destroyed manager window. Its second-instance handler called `manager.isMinimized()` without checking the native window's lifetime. A controlled Electron regression reproduced the same stack, including the column-21 call and EventEmitter.emit frame.

The handler now ignores second-instance events during shutdown or when the manager is absent/destroyed. Normal minimized-window restoration and focus remain intact. The fix cannot retrofit an already-running old executable: close the old application before opening an updated version. On this computer the stale windowless process was ended after a separate backup of user data, and the downloaded 0.1.1 application then opened with a normal window. No user workspace was reset or migrated.

The regression waits for the manager UI to finish startup before destroying it. Its initial setup exposed a startup-load timing race in the test itself; that setup was corrected before the final passing regression run. Test data uses a separate temporary directory.

Source version 0.1.2 retains authenticated SOCKS5 from 0.1.1. Real NordVPN account connectivity remains unverified. The portable executable is `release/Profile-Workspace-0.1.2.exe`; its SHA256 is listed in `release/SHA256SUMS.txt`.

Verification: build passed, 16 unit tests passed, 17 Electron tests passed. Four lifecycle/proxy tests also passed against the packaged 0.1.2 payload. Full npm audit reported zero known vulnerabilities. The author reviewed the complete lifecycle diff and found no consequential remaining issues.
