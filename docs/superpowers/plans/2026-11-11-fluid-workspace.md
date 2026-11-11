# Fluid Workspace Implementation Plan

> Execute inline with executing-plans. The user said to proceed; no further planning interview is needed.

**Goal:** Smooth, stable desktop interaction while retaining existing accounts and browser behavior.
**Architecture:** React presence boundaries retain exiting overlays; native view transitions crossfade only changing content. CSS fixes layout discontinuities and floats selection actions.
**Tech Stack:** Existing React 19, Electron 45, TypeScript, CSS and Playwright; no new dependency.
**Spec:** ../specs/2026-11-11-fluid-workspace-design.md

## Global constraints

No changes to engine, appId, userData, partitions, profile schema, encryption or cookie services. Test only with isolated data directories. Preserve unrelated landing/ work.

## Review focus

Rapid navigation must settle correctly; closing forms cannot submit; reduced-motion must bypass delays; profile opening cannot move navigation/table; real user data must remain recoverable.

## Tasks

- [x] 1. Hash-verify offline userData backup; baseline build/unit tests; capture baseline UI with fictional data.
- [x] 2. Add and run failing Playwright regressions for stable detail layout, retained editor close, rapid navigation and reduced motion.
- [x] 3. Implement presence and transition helpers; wire App, profile tabs and group dialogs; refine layout, forms, table and bulk actions. Run new regressions green.
- [x] 4. Review actual diff, build, unit and Electron suites, inspect screenshots, build packaged app and verify UI plus session/OAuth behavior. Update OVERVIEW.
- [x] 5. Install locally only after verification, verify payload and metadata preservation, reopen manager and report backup location and limits. No publication.
