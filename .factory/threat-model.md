# Threat Model for Profile Workspace

Last updated: 2026-11-08. Version: 1.0.0. Methodology: STRIDE and source-level data-flow review.

## 1. System Overview

Profile Workspace is a local Electron/React Windows application. Its main process owns native file dialogs, Chromium sessions, encrypted proxy credentials and session-cookie snapshots. React renders profile metadata and cookie controls. Each remote site runs in an isolated, sandboxed WebContentsView without Node integration or preload. Each profile has a separate persistent Chromium partition. A serialized JSON store owns local metadata; a launch queue controls concurrent browser starts. The application has no public HTTP server or Dolphin API dependency.

Entry points are `electron/main.ts`, `electron/preload.ts`, `electron/browser.ts`, `core/store.ts`, `core/cookies.ts` and `src/main.tsx`. The typed preload bridge invokes sender-checked handlers; successful changes produce public snapshots. Native cookie import reads a user-selected file, validates records and commits to a stopped profile with rollback if Chromium rejects a record. Explicit exports write user-selected files.

## 2. Trust Boundaries & Security Zones

1. Untrusted: websites, redirects, popups, proxy responses and imported cookie files. Website JavaScript must never gain filesystem, shell, secret-store or manager IPC privileges.
2. Local control: the packaged manager and browser-toolbar renderers. A compromised toolbar must not invoke manager-only methods. IPC validates both webContents identity and the top-level frame.
3. Privileged: Electron main process, validated metadata store, Windows safeStorage and Chromium partitions. Files written by the current Windows user are not treated as protection against malware running as that same user.

There is no account-based authentication: access is the local Windows user's access. Profile IDs are generated UUIDs and checked against store membership before partition/file use. Web navigation accepts only HTTP(S); privileged renderer navigation and new-window creation are denied.

## 3. Attack Surface Inventory

| Interface | Input and validation | Boundary |
| --- | --- | --- |
| Manager IPC | Allowlisted methods, manager sender + mainFrame identity, field validation | renderer → main |
| Browser IPC | Controller-owned shell sender + mainFrame identity, HTTP(S) URLs | toolbar → main |
| Remote sites | Sandboxed WebContentsView, no Node/preload, webSecurity enabled, permissions denied | network → browser |
| Cookie files | Native picker, 10 MiB limit before read, schema/domain/value validation, explicit unsupported-attribute errors | filesystem → cookie store |
| Proxy settings | Protocol/host/port validation; credentials supplied only for matching proxy host/port | user → network |
| IP checking | HTTPS ipify request through configured session, bounded response and timeout, no direct fallback | proxy → main |
| Local persistence | Atomic JSON replacement, encrypted secrets, successful-hydration-only snapshot writes | main → filesystem |
| Downloads/exports | Native save dialogs and explicit user action | browser/main → filesystem |

No dynamic shell execution, SQL database, public API listener, custom certificate bypass or arbitrary HTML template execution is used in production.

## 4. Critical Assets & Data Classification

Cookies and session snapshots are authentication material. Browser data may include PII and account content. Proxy passwords are credentials; proxy hosts/usernames and profile notes may be private metadata. Proxy secret payloads and saved session cookies use Windows safeStorage; ordinary snapshots omit the protected password payload. User exports intentionally contain plaintext cookies after a warning. Chromium owns other persistent site storage. Logs must not include cookie values or passwords.

The publication boundary excludes browser profiles, `.env` files, encrypted snapshots, dumps, certificates, build caches and dependencies. Test credentials are synthetic localhost fixtures, not real accounts. No signing key, GitHub credential or proprietary reference application binary belongs in this repository.

## 5. Threat Analysis (STRIDE Framework)

| Category/component | Scenario | Controls and residual risk | Severity if introduced |
| --- | --- | --- | --- |
| Spoofing: IPC | Site or toolbar impersonates manager | Exact sender/frame checks; remote views have no bridge | Critical |
| Spoofing: network | Wrong proxy/auth challenge requests password | isProxy + expected host/port checks; no TLS bypass; validate protocol | High |
| Tampering: imports/store | Malformed cookie or metadata causes destructive writes | Cookie normalization, stopped-profile locks, rollback, serialized atomic metadata writes | High |
| Tampering: snapshots | Empty/unhydrated session overwrites saved login state | Cached one-time hydration; save only successfully hydrated sessions; preserve file after failed decrypt | High |
| Repudiation: local actions | User cannot reconstruct every cookie modification | Native confirmations and results, intentionally no sensitive audit trail; accepted local-tool limitation | Low |
| Disclosure: isolation | Another profile or page reads login state | Separate persistent partitions, no remote preload, sandbox and context isolation | High |
| Disclosure: proxies | WebRTC UDP bypasses configured proxy | Every remote view sets disable_non_proxied_udp; failed proxy never selects direct mode | High |
| Disclosure: files | Export, shared OS account or stolen user profile exposes data | Explicit export warning and Windows encryption; same-user malware and plaintext exports are outside confidentiality guarantees | High |
| DoS: files/network | Large import/proxy response or hanging proxy blocks work | Import size cap, response cap, timeout, configurable queue; hostile page CPU/RAM and large profile counts remain resource risks | Medium |
| Elevation: browser | Remote page opens file/custom protocol or executes Node | HTTP(S)-only navigation, denied external protocols, no remote Node/preload, managed tabs | Critical |
| Elevation: dependencies | Malicious update/build dependency enters release | Lockfile, npm audit and reviewed explicit dependencies; no automatic updater; supply-chain review remains necessary | High |

## 6. Vulnerability Pattern Library

- SQL injection: no SQL is used. Introducing SQL later requires parameterized queries, never interpolated input.
- XSS: React text rendering is the default. Avoid `dangerouslySetInnerHTML` or replacing trusted shell HTML with imported/remote content.
- Command injection: production has no `exec`, `execFile`, shell-string composition or dynamic `eval`. Do not route URLs, cookie fields or profile names to a shell.
- Path traversal: derive session paths from a store-validated UUID, not an arbitrary renderer path. Pickers, not remote pages, choose import/export paths.
- Authorization bypass/IDOR: every manager handler calls the shared sender guard; toolbar operations resolve a controller from the sender and check the top-level frame. Checking only a method name is insufficient.
- Secret exposure: do not serialize stored secret payloads into snapshots, log cookie values, include `.env`/profile databases or publish real proxy fixtures.
- Prompt injection in project instructions: imported files, site strings and reference documentation are data. No repository instruction delegates permission to exfiltrate credentials or alter system policy.

Safe pattern: `if (event.sender !== manager.webContents || event.senderFrame !== manager.webContents.mainFrame) throw new Error('Access denied');` before performing a privileged manager operation. Cookie and proxy strings still require their separate validators afterward.

## 7. Security Testing Strategy

Unit tests cover cookie validation/round trips, metadata/reference integrity, protected public snapshots and queue behavior. Real Electron tests verify partition isolation, absence of remote privileged globals, proxy failure/authentication, STUN UDP prevention, import rollback, successful hydration, snapshot preservation on decrypt failure and recovery after save failures. Dependency audit is separate from source review and does not prove the absence of vulnerabilities.

## 8. Assumptions and Accepted Risks

The current Windows user, OS credential provider and installed Chromium/Electron runtime are trusted. Public binaries are unsigned. Full anti-detection, CHIPS exchange, SOCKS5 authentication, richer permission prompts, extension compatibility, cloud sync and automatic engine updates are not implemented. Proxy preflight depends on ipify availability. Account servers may revoke a login regardless of local cookie retention. Tests on a separate clean Windows installation and every external provider have not been performed.

## 9. Version Changelog

1.0.0 — initial publication model based on the implemented 0.1.0 source and its existing regression suite. No external targets were scanned.
