# Fluid workspace

The user authorized proceeding and prioritized keeping existing accounts and logins. The requested reference is Donut's coherent, smooth daily interaction, rather than a literal copy of its assets or code.

## Direction and findings

- Product: a local workspace for persistent browser accounts.
- Character: calm, precise, responsive.
- World: a graphite desktop workbench; use the user-requested Vesper peach accent and mint success states.
- Moments: a selected profile and its working connection carry the emphasis.
- Signature: a quiet running indicator that stays in the same place.

Audit: navigation replaces content instantly; closing overlays unmounts instantly; selecting a profile changes grid columns and collapses the sidebar at 1360–1599px; opening bulk actions pushes the table down. Existing icons and typography already form a usable direction; the user subsequently requested Vesper as the default theme, so use polish mode rather than replacing the brand.

## Approach

CSS-only animations would improve entrance but cannot retain closing content or fix state transitions. Rebuilding the app and changing the browser engine together would complicate session preservation. Implement a focused React interaction pass: interruptible native view transitions, retained overlay exits, stable overlay details, floating bulk actions and clearer form grouping. Keep all browser/session/store/IPC behavior unchanged.

## Constraints and acceptance

- Make and hash-verify a complete offline userData backup before installing anything.
- Preserve appId, userData location, profile IDs, partitions, encryption, cookies and site storage.
- Keep browser engine unchanged in this delivery; engine migration requires a separate session-compatibility investigation.
- Navigation keeps its position; profile details never compress the table or collapse the sidebar.
- Panels enter in 240ms and exit in 160ms; reduced-motion closes immediately. Closing content is inert and cannot submit twice.
- Use native view transitions with immediate fallback; rapid input must settle on the last selected destination.
- Keep full notes, natural sorting, groups, existing-tag buttons and all current actions.
- Verify UI at 1024, 1440 and 1920 widths, keyboard dismissal, rapid switching and reduced motion, plus the existing session-restart and OAuth regressions.

No external Donut implementation is copied. No commit, push or publication is required.

## Theme steering

The user explicitly selected https://github.com/vladzima/vesper-theme during implementation. Use VSCode/Vesper.json as the palette reference: background #101010, raised #1C1C1C, selection #232323, foreground #FFFFFF, muted #A0A0A0, peach #FFC799, hover #FFCFA8, mint #99FFE4, error #FF8080. This overrides the earlier teal direction.
