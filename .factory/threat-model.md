# Threat Model for Profile Workspace

Last updated: 2026-11-11. Version: 1.2.0. Methodology: STRIDE and source-level data-flow review.

## 1. System Overview

Profile Workspace is a local Electron/React Windows application. Its main process owns native file dialogs, Chromium sessions, encrypted proxy credentials and session-cookie snapshots. React renders profile metadata and cookie controls. Each remote site runs in an isolated, sandboxed WebContentsView without Node integration or preload. Each profile has a separate persistent Chromium partition. A serialized JSON store owns local metadata; a launch queue controls concurrent browser starts. The application has no public HTTP server or Dolphin API dependency.

Entry points are `electron/main.ts`, `electron/preload.ts`, `electron/browser.ts`, `core/store.ts`, `core/cookies.ts` and `src/main.tsx`. The typed preload bridge invokes sender-checked handlers; successful changes produce public snapshots. Native cookie import reads a user-selected file, validates records and commits to a stopped profile with rollback if Chromium rejects a record. Explicit exports write user-selected files.

## 2. Trust Boundaries & Security Zones

1. Untrusted: websites, redirects, popups, proxy responses and imported cookie files. Website JavaScript must never gain filesystem, shell, secret-store or manager IPC privileges.
2. Local control: the packaged manager and browser-toolbar renderers. A compromised toolbar must not invoke manager-only methods. IPC validates both webContents identity and the top-level frame.
   Remote OAuth child tabs preserve Chromium opener/postMessage behavior through `setWindowOpenHandler.createWindow`. The supplied child WebContents is adopted into a profile WebContentsView; it retains the same session/proxy, enforced sandbox/context isolation/webSecurity, no Node/preload and disabled non-proxied WebRTC UDP. HTTP(S) or initial about:blank popups are allowed; file/custom schemes are rejected. Opener messaging follows normal browser same-origin and postMessage rules and grants no manager IPC access.
3. Privileged: Electron main process, validated metadata store, Windows safeStorage and Chromium partitions. Files written by the current Windows user are not treated as protection against malware running as that same user.
4. Local SOCKS5 bridge: each authenticated SOCKS5 session owns an HTTP listener on 127.0.0.1 with an ephemeral port and random local credentials. It always forwards to the configured SOCKS upstream; service credentials remain in main-process memory. Unauthenticated local requests receive 407. Bridge lifecycle follows proxy checks and profile sessions; HTTP target domains use remote SOCKS DNS.
5. Updates: installed Windows builds trust releases from the fixed public Biomistik-Official/Profile-Workspace GitHub repository. electron-updater 6.8.11 uses HTTPS and SHA512 metadata validation; no Authenticode certificate is currently configured. Stable upgrades only, web installers disabled. No renderer-selected feed URL, token or arbitrary executable path is accepted. Manager-only IPC can check or request normal application quit after download. Installation is attached to the actual quit event, after asynchronous session persistence; a cancelled shutdown cannot launch it. Development, portable and isolated-test instances disable production update checks.
6. Version 2.0.0 removes profile browser-parameter generation, fingerprint IPC and native emulation overrides from 0.1.6/0.1.7. Existing obsolete metadata may remain in local JSON but is not applied. Numeric ordering, tag buttons and wrapped notes render user strings as React text; stored field validation, sender guards, cookie encryption and proxy boundaries remain unchanged.

There is no account-based authentication: access is the local Windows user's access. Profile IDs are generated UUIDs and checked against store membership before partition/file use. Web navigation accepts only HTTP(S); privileged renderer navigation and new-window creation are denied.

## 2.1 Camoufox native backend (2.2.0)

The trusted main process forks a local utility process that loads the pinned Camoufox0.5.9/Playwright-core1.62.0 launcher. No HTTP control port or remote debugging endpoint is exposed by the product. Untrusted web pages run in native Firefox and cannot call manager IPC. Only the manager sender/main frame can request engine installation, profile operations or shared bookmark edits.

Legacy profiles with no engine field retain Chromium. Stored and submitted engine names are validated, and in-place conversion is rejected. Native profile directories are derived from validated UUIDs under userData/camoufox. The private engine runtime lives under LOCALAPPDATA/Profile Workspace/Engines. Its initial files are hard-linked (copied across filesystems) from the downloaded paired browser. Product policies are atomically replaced, breaking the policy-file hard link; upstream installation policy is unchanged. Policy writes are serialized and temporary names are unique. Engine installation and upstream release assets are a supply-chain trust boundary; no claim of protection against same-user tampering is made.

Per-profile native configuration contains device metadata but no proxy credentials or process environment. Proxy credentials travel only over private utility IPC; authenticated SOCKS traffic uses the existing random-auth loopback bridge. Assigned proxies are preflighted; no launch fallback selects direct mode. Native WebRTC and HTTP/3 are disabled; DNS prefetch, network prediction, DoH and direct proxy failover are disabled. Native geolocation, camera and microphone permissions are denied. User locale/timezone are explicit; automated region matching and guaranteed unlinkability are not claimed.

Periodic and response-triggered session snapshots use Windows encryption. Native stop takes an explicit final snapshot; OS-window close uses the latest captured cookies and remains susceptible to abrupt process/OS loss between captures. Failed decryption blocks native restoration rather than overwriting the source. Pending imports are distinguished from restart snapshots so disabling restoration does not reinject old sessions. Worker requests, native event saves and direct pending saves block destructive profile mutations. Timeout retains ownership until a queued stop is confirmed, including a late failed start. Save failures preserve unsaved data for quit recovery.

Shared bookmarks are validated HTTP(S) metadata and serialized as JSON policies in the app-private engine. They appear in a managed toolbar folder on the next native launch; personal Firefox bookmarks outside that folder remain per profile. Bookmarks are intentionally shared between account sessions. Isolated test workspaces share the same Windows user's engine runtime, so native policy tests are run serially. The manager has no cloud bookmark service.

## 3. Attack Surface Inventory

| Interface | Input and validation | Boundary |
| --- | --- | --- |
| Manager IPC | Allowlisted methods, manager sender + mainFrame identity, field validation | renderer → main |
| Browser IPC | Controller-owned shell sender + mainFrame identity, HTTP(S) URLs | toolbar → main |
| Remote sites | Sandboxed WebContentsView, no Node/preload, webSecurity enabled, permissions denied | network → browser |
| Cookie files | Native picker, 10 MiB limit before read, schema/domain/value validation, explicit unsupported-attribute errors | filesystem → cookie store |
| Proxy settings | Protocol/host/port validation; credentials supplied only for matching proxy host/port | user → network |
| SOCKS5 bridge | Loopback bind, random local authentication, mandatory upstream, UTF-8 credential byte limit, no verbose secret logging | Chromium → Node → SOCKS5 |
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
| Elevation: dependencies | Malicious update/build dependency enters release | Lockfile, npm audit and reviewed explicit dependencies; fixed GitHub feed and SHA512 integrity validation; unsigned release ownership and supply-chain review remain trust requirements | High |

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

The current Windows user, OS credential provider and installed Chromium/Electron runtime are trusted. Public binaries are unsigned. Guaranteed anti-detection, CHIPS exchange, richer permission prompts, arbitrary managed extensions, cloud sync and automatic Camoufox engine updates are not implemented. Camoufox is an opt-in backend for new accounts; actual provider-login acceptance remains unverified. SOCKS5 authentication is supported through pinned proxy-chain 2.7.1; SOCKS5 transport itself is not VPN encryption. Proxy preflight depends on ipify availability. Account servers may revoke a login regardless of local cookie retention. Tests on a separate clean Windows installation and every external provider, including actual NordVPN service credentials, have not been performed.

## 9. Version Changelog

1.0.0 — initial publication model based on the implemented 0.1.0 source and its existing regression suite. No external targets were scanned.

1.1.0 — authenticated SOCKS5 loopback bridge, credential and remote-DNS boundaries, per-session cleanup. No external targets were scanned.

1.2.0 — native utility backend, immutable engine ownership, private runtime policies, native cookie preservation, timeout/save locks and shared bookmarks. Review covered source, local synthetic fixtures and packaging; no external targets were scanned.
