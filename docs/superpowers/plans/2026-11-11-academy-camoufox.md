# Camoufox Academy Implementation Plan

> **For agentic workers:** Use executing-plans for inline implementation and a fresh whole-change review at the end.

**Goal:** Run the existing three Academy quizzes and claim their XP on selected native profiles.
**Architecture:** Narrow manager IPC forwards validated Academy actions to the app-owned native Playwright context. External runner supports both native profiles and legacy Chromium.
**Tech Stack:** Electron 45, Camoufox 0.5.9, Playwright-core 1.62, Node 22, TypeScript/ESM.
**Spec:** `docs/superpowers/specs/2026-11-11-academy-camoufox-design.md`.

## Global constraints
- Keep existing profile IDs, directories, proxies and cookies; never launch a second context on user profile data.
- Only fixed Supercell courses; no general JS/URL execution interface exposed through IPC.
- Analyze before answering; unknown questions and non-A+ stop. Verify both XP claims.
- No publication or unrelated UI changes; preserve untracked landing directory in original checkout.

## Review focus
- Unknown or stopped profile, incorrect engine and untrusted renderer are rejected.
- Completed exams must not be reopened into a stale modal.
- Triplicated decorative button text must still select the button, never a card anchor.
- Browser close/navigation/login redirect must stop without exposing account data.
- Distribution includes all ESM resources; both installed and standalone entry points remain usable.

## Tasks
- [x] 1. RED/GREEN: Academy module validates actions and implements analyze/quiz/claim on an existing Page. Fixed dictionary, exact labels, dedicated tab, bounded waits.
- [x] 2. RED/GREEN: manager-only IPC/controller/worker dispatch and packaging copy; rejection tests and real native fixture.
- [x] 3. RED/GREEN: external runner discovers native profiles and uses the new bridge while retaining Chromium selection.
- [x] 4. Full unit/build/native/package checks, fresh code review, documentation and local delivery. Preserve offline app backup before installation.

## Ledger
- Baseline: 35 unit tests pass on clean tracked source. Isolated managed worktree; dependencies reused through a directory junction.
- Ruling: keep START.cmd as the user entry point; expose scoped app actions instead of a general automation server.
- Ruling: use analyze/quiz/claim RPCs, not a long uninterruptible whole-account call, to retain progress and bounded operation lifetimes.

- Review fixes: each selected account gets its own preflight; the worker enforces approved analysis. Hung actions actively close only their dedicated tab. Scoped cancellation tombstones handle both cancellation during newPage and cancellation overtaking the original RPC; both races have regression tests.
- Dependency setup ruling: replaced the initial node_modules junction with a private npm ci installation after packaging exposed missing transitive dependencies. npm audit: 0 vulnerabilities.
- Final verification: 42 unit tests; 31 development Electron UI/IPC tests; 4 native tests; packaged 28 UI/IPC tests plus four Academy/proxy reruns (the first three proxy runs expected obsolete 0.1.2; corrected test-version environment to 2.2.2); 3 packaged native scenarios; 19 external runner tests.
- Local delivery: installer exit 0, installed ASAR matches tested package, 29 profiles and 6 proxies retained; 231 protected files unchanged against offline manifest before native profile reopen. Complete backup: 73,427 files, zero copy failures.
- Installed end-to-end read-only readiness: START client discovery -> manager IPC -> worker-owned Camoufox context -> live Supercell question bank succeeded for profile 2, 24 questions, zero unresolved. No quiz answers/XP were sent in that live readiness check.
- Public push/release not performed. Source modifications integrated into original checkout; unrelated landing/ preserved.
