# Profile Workspace 2.0 — proposed design

Status: approved by the user after the imagegen preview. Proceed with implementation, with always-visible notes and light animations.

## Scope and baseline

Use the 0.1.5 application at bce5025 as the behavioral baseline. Versions 0.1.6 and 0.1.7 added persistent fingerprint parameters and their language migration; exclude these features from the new release. Keep 0.1.5 browser tabs, Sites drawer, OAuth handling, proxy support, cookies and installed-app updater. The requested next version is interpreted literally as 2.0.0.

Do not reset or delete real user data. Before any installed-app replacement, back up the workspace and check that metadata saved by 0.1.7 can be opened by the new version without deleting profile partitions, cookies or proxies. Do not run the old application against real data as a compatibility experiment. Public release/publication is outside this design approval.

## Findings

- App.tsx uses name.localeCompare(other, 'ru') without numeric comparison, producing 1, 10, 11, 12, 2.
- ProfileForm accepts comma-separated tags but receives no catalog of existing tags; bulk editing has the same limitation.
- The current interface already has a coherent graphite/teal identity and Lucide icons. The redesign should retain this identity.
- Craft issues: 10–11px secondary/table text, oversized empty header spacing, inconsistent spacing values, a very narrow tags column hiding tags behind +1, actions exposed primarily on hover, and strongly blue-green neutral surfaces.

## Direction

- Product: a local desktop console for organizing and launching isolated browser profiles.
- Character: calm, exact, responsive.
- World: a dependable instrument panel for sessions and connections.
- Moments: the ordered profile list with clear running states; selectable existing tags in the editor.
- Signature: a small status indicator paired with explicit status text, consistently used in lists and details.

## Visual system

Retain dark mode and the teal identity. Use neutral graphite surfaces (#141415 background, #19191b panels, #232325 raised controls), primary #ededed, secondary #a1a1a6 and muted #94949b, with teal for selection and primary action. Measure contrast against actual surfaces.

Use local system UI typography (Segoe UI on Windows), 14px body/table labels, 12px metadata, 28px page headings, weights 400–600 and tabular numerals. Keep Lucide, consistent 18px primary icons and 1.5 stroke. Use a 4px spacing grid, a 240px sidebar and 32px content gutters. Rows have a consistent 76px minimum and grow to show the entire note, with measured virtualization. Notes are never hidden behind hovering, line clamping or errors. The table should remain fluid and fill available height.

Apply the redesign across profiles, proxies, settings, profile detail, dialogs and browser chrome while preserving section order and features. Use visible, labeled launch/stop actions, legible notes, quiet tag chips, clear selected rows, keyboard focus and disabled/busy states. Avoid decorative imagery, dashboard metrics invented for decoration, glow and looping decoration.

Use named color/border/opacity/transform transitions of 120–180ms, menus around 180ms, and respect reduced motion. Keep virtualization and stable profile IDs; do not add animation dependencies or remote fonts.

## Behavior

Natural ascending name sorting must produce 1, 2, 3, …, 10, 11, 12 and Profile 2 before Profile 10. Preserve the separate recent-change sorting option. Apply natural ordering to the existing tag catalog as well.

Below the tags input, show existing workspace tags as buttons. Clicking an unselected tag appends it once and keeps typed tags. Clicking a selected tag removes it; expose selection with aria-pressed and a check mark. Buttons must not submit the form. Support the same picker in new/edit profile forms and bulk editing. Keep custom tag entry and existing bulk replacement semantics explicit.

## Approach considered

1. A CSS-only polish is smaller but cannot fix tag interaction or restore 0.1.5 behavior.
2. Recommended: retain Electron/React, use 0.1.5 as the source baseline and redesign the existing components with focused natural-sort/tag changes.
3. A new framework or shell would add migration risk without helping the requested workflows.

Approach 2 was approved after the imagegen preview and implemented.

## Verification

First reproduce natural-sort and tag-picker behavior with failing regressions; then verify the fixes. Run build, relevant unit tests and Electron integration tests against isolated temporary data. Cover numeric and mixed names, tag add/remove/deduplication, custom tags, persistence and bulk editing. Check 0.1.7-shaped metadata compatibility without real credentials. Inspect running UI at desktop sizes, detail/dialog layouts, keyboard access and reduced motion. Build a local installer after source checks; report separately whether installation or publication occurred.

## Attribution

Design process informed by UI/UX Pro Max and unslop by Damir Sokolovsky (@heydamir), CC BY 4.0. The broad design-system search returned marketing-oriented suggestions; those are discarded. The explicit style search matched data-dense-dashboard, whose readable table, quiet chrome and low-motion guidance fit this application.
