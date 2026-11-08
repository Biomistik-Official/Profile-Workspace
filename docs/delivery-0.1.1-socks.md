# Profile Workspace 0.1.1 — authenticated SOCKS5

Delivered locally on 2026-11-08. Portable executable: `release/Profile-Workspace-0.1.1.exe` (111,995,287 bytes). SHA256 is recorded in `release/SHA256SUMS.txt`. Fast packaged launch remains `release/win-unpacked/Profile Workspace.exe`; the existing desktop shortcut targets that path. Close the old running 0.1.0 application before opening the new version. No normal user profiles or running user browser sessions were modified during tests.

The existing SOCKS5 form now accepts service credentials. A private loopback HTTP bridge performs SOCKS5 authentication and remote DNS on behalf of Chromium. Each active session gets its own bridge with random local authentication. Bridges close after checks, profile closure, cancellation/failure, reconfiguration and application shutdown. Passwords remain encrypted with Windows safeStorage. No direct fallback is configured.

Verification:

- TDD: store rejection and Electron's unsupported-auth error were reproduced before implementation. Bridge tests caught special-character URL encoding and HTTP remote-DNS assumptions before correction.
- `npm test`: 16 unit tests passed, including real HTTP and CONNECT forwarding through a controlled authenticated SOCKS5 endpoint, local bridge authentication, provider rejection, closure, encrypted persistence and byte limits.
- `npm run test:e2e`: 16 tests passed, including real Electron proxy configuration via UI, ipify check, browser navigation through remote DNS, bridge port closure, restart, wrong-password launch rejection and existing HTTP authentication.
- The three proxy E2E tests also passed against the packaged executable in `release/win-unpacked`, with `app.isPackaged === true` and version `0.1.1`. The portable wrapper was built successfully; automated smoke tested its packaged payload.
- `npm run dist`: completed successfully. `npm audit`: zero vulnerabilities. `git diff --check`: no whitespace errors.
- Independent read-only code review found no consequential findings.

Actual NordVPN service access, simultaneous distinct provider accounts and a separate clean Windows machine were not verified. No provider credentials are included. See [Russian setup guide](nordvpn-proxy.md). Publication of the source and portable executable as GitHub release v0.1.1 was subsequently authorized by the user.
