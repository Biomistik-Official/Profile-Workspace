# Profile Parameters Implementation Plan

**Goal:** Stable editable Chromium parameters per profile, with regeneration.
**Spec:** ../specs/2026-11-09-profile-fingerprints-design.md
**Architecture:** validated shared model/core generator → store → session/CDP controller → profile form.

- [x] Tests first: generate/validate defaults, reject invalid values, persist edits, migrate old profiles, keep copied profiles independent. Implement core/fingerprint.ts and storage contracts.
- [x] Tests first: verify language, timezone, screen, CPU and UA in real Electron and popup after navigation/restart. Implement electron/fingerprint.ts and lifecycle-safe application in ProfileBrowser before requests.
- [x] Add profile form section with manual settings and generate action; integrate duplication and summary; preserve running-profile edit lock.
- [ ] Run build/unit/Electron checks and fresh whole-diff review; update docs/security report; release 0.1.6 through the installed updater and verify installed version/data.

## Constraints and review focus
No change to cookies on regeneration. No arbitrary JS from profile settings. Validate timezone/language, dimension bounds and UA CRLF. Use actual browser version by default. New tab/popup settings must apply before request. Preserve startup cancellation and destroyed-tab safety. Canvas/WebGL/Audio/worker emulation is out of scope and must not be claimed.

## Ledger
User selected current Chromium implementation after discussing engine limitations, and stable per-profile values plus a regeneration button. Continue inline on the existing branch; all preceding work is committed. The existing updater makes this release the first real production-upgrade verification.

Core and store RED/GREEN completed, including an observed failing reopen-stability regression fixed by atomic migration persistence. Native Electron and UI regressions pass. Full suite: 27 unit + 22 Electron tests passed. Independent reviewer found no actionable P1/P2 issues and separately probed cross-site/blank OAuth child parameter behavior; documented timing/surface limitations remain. Final installer rebuild, release, and production updater verification pending.
