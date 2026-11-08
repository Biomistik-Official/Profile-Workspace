# Authenticated SOCKS5 Implementation Plan

**Goal:** Use NordVPN as an authenticated proxy assigned to browser profiles.
**Architecture:** An authenticated loopback HTTP bridge forwards exclusively through the configured SOCKS5 server. Existing Electron proxy authentication handles local random credentials.
**Tech stack:** TypeScript, Electron, proxy-chain 2.7.1 (CommonJS), Vitest, Playwright.
**Spec:** ../specs/2026-11-08-authenticated-socks-design.md

## Constraints and review focus

Keep Windows password encryption and existing HTTP(S)/unauthenticated SOCKS5. No direct fallback. Check wrong credentials, upstream outage, remote hostname resolution, independent profile sessions, closure and restart. Work in the existing clean codex/profile-workspace checkout; no commit or publication requested.

### Task 1: Store and bridge

- [x] Add failing store tests for authenticated SOCKS5 persistence and byte limits; run Vitest and observe the current rejection.
- [x] Add controlled SOCKS5 server fixture and failing real-network bridge tests for HTTP, CONNECT, local authentication, failed upstream authentication and closure.
- [x] Add electron/socks-bridge.ts: startSocksBridge(proxy, credentials) returns proxyRules, local credentials and close(): Promise<void>. Use proxy-chain bound to 127.0.0.1 and mandatory upstream routing. Enable store credentials with protocol byte validation. Run unit suite.

### Task 2: Electron integration and delivery

- [x] Add failing Electron tests for save/check, actual browser routing, rejection of bad credentials, stop/restart cleanup and encrypted persistence.
- [x] Integrate session-owned bridge lifecycle into electron/main.ts; update src/components/ProxyForm.tsx and src/App.tsx hints.
- [x] Update README.md, OVERVIEW.md and docs/nordvpn-proxy.md with actual setup and limitations.
- [x] Build and run full unit/Electron suite, audit dependencies, review actual diff, package portable executable and smoke-test packaged proxy configuration.
