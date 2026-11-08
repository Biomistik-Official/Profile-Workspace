# Profile Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the approved local Windows profile manager and a portable executable.

**Architecture:** React renderer communicates through an allowlisted preload bridge with the Electron main process. Per-profile persistent Chromium sessions live in separate storage partitions; WebContentsView tabs have no privileged bridge. Atomic local JSON metadata and OS-encrypted proxy credentials/session-cookie snapshots require no Dolphin services.

**Tech Stack:** Electron 45, React 19, TypeScript, Vite, Vitest and Playwright Electron tests. Exact installed dependencies are recorded in package-lock.json.

**Spec:** ../specs/2026-11-08-profile-workspace-design.md (approved by user 2026-11-08).

## Global Constraints

- Windows first, Russian interface, independent implementation; no proprietary Dolphin code.
- No advertising, account requirement, subscriptions or artificial profile count limit.
- Isolated persistent profiles; cookie imports do not mutate running profiles or erase data when invalid.
- Proxy failure never silently falls back to direct traffic. Unsupported proxy authentication must be rejected explicitly.
- Values and passwords never enter normal logs. No remote page receives a Node/preload bridge.
- Fingerprint spoofing and Dolphin-equivalent anti-detection are not claimed.

## Review Focus

- Malformed/empty imports and unsupported partitioned cookies must not erase existing sessions (Task 1/3 tests).
- Concurrent metadata edits and application restarts must not lose profile state (Task 1 tests).
- Duplicate launch requests and cancellation must not open the same profile twice (Task 2/3 tests).
- Proxy credentials and connection failures must not leak via logs or fallback (Task 3 integration).
- Keyboard focus, large lists and narrow desktop windows must remain usable (Task 4/5 E2E).

### Task 1: Domain and persistence

Files: `shared/types.ts`, `core/cookies.ts`, `core/store.ts`, `core/validation.ts`, `tests/unit/*.test.ts`.
Interfaces: `parseCookies(text): CookieParseResult`, `serializeCookies(cookies, format): string`, `WorkspaceStore.open(path, secrets)`, profile/proxy CRUD and settings updates; `snapshot()` exposes no passwords.
- [x] Write tests for JSON/Netscape round-trip, HttpOnly, host-only, malformed/partitioned input, atomic persistence, validation and reference integrity.
- [x] Run `npm test`: expect missing modules/features (RED).
- [x] Implement codecs and store, then run `npm test`: all domain tests pass (GREEN).

### Task 2: Launch scheduling

Files: `core/queue.ts`, `tests/unit/queue.test.ts`.
Interfaces: `LaunchQueue.enqueue(ids)`, `cancel()`, `configure(settings)`; injected async starter, status notifications, uniqueness and parallelism.
- [x] Write concurrency, duplicate and cancellation tests; run and observe RED.
- [x] Implement queue and run full unit suite to GREEN.

### Task 3: Desktop and browser runtime

Files: `electron/main.ts`, `electron/preload.ts`, `electron/browser.ts`, `electron/cookie-service.ts`, `tests/e2e/runtime.spec.ts`, `playwright.config.ts`.
Interfaces: typed `WorkspaceApi` and `BrowserApi` through IPC; session partition derived only from validated profile ID; manager-only mutation channels.
- [x] Write real Electron integration tests for profile isolation, persistence, cookie round trip, proxy failure and browser shell navigation; observe RED before implementing runtime.
- [x] Implement encrypted secrets, safe windows, tabs, proxy binding, cookie rollback and import/export native file dialogs.
- [x] Run runtime integration suite and resolve failures.

### Task 4: Approved UI

Files: `src/App.tsx`, `src/components/*`, `src/styles.css`, `index.html`, `tests/e2e/workspace.spec.ts`.
Interfaces: consumes `WorkspaceApi` snapshots/events; edits profiles/proxies, cookies, settings and queue through existing typed bridge.
- [x] Write UI workflow tests for empty state → create/edit → search/select → browser launch/stop, settings and cookie import preview. Observe RED.
- [x] Implement graphite/teal design, contextual bulk actions, detail tabs, forms, keyboard focus and virtualized lists.
- [x] Run full suite and inspect screenshots at 1440×900 and 1024×768.

### Task 5: Delivery

Files: `README.md`, `OVERVIEW.md`, `assets/icon.ico`, `release/*` (ignored).
- [x] Run typecheck/build, full unit suite, integration tests and dependency audit; review actual code with code-review and an independent reviewer.
- [x] Build portable Windows executable, smoke-test the packaged application using isolated data, then open the application for the user.
- [x] Update overview and record verified behavior and actual limitations. Do not commit/push/publish unless separately requested.

## Execution decisions

The user explicitly authorized creation after reviewing the product design; execute in this chat without another approval round. The repository has no commits and no product code, so use a new `codex/profile-workspace` branch in the current checkout instead of creating an unusable worktree from an unborn HEAD. JSON metadata avoids a native SQLite packaging dependency; atomic replacement and validation are required. Chromium engine updates ship with future application releases; do not claim an automatic updater.
