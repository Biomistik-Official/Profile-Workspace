# Cookie-Editor Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Camoufox profile opens with the bundled Cookie-Editor Firefox addon while existing profile data stays intact.

**Architecture:** A small ESM provisioning module copies the bundled extracted addon into app data and returns an absolute path. The Camoufox utility worker passes that path in the existing `launchOptions({ addons })` call.

**Tech Stack:** Electron 45, Camoufox 0.5.9, Node ESM, Vitest, Playwright native tests.

**Spec:** `docs/superpowers/specs/2026-11-12-cookie-editor-extension-design.md`

## Global Constraints

- Camoufox profiles only; Chromium is out of scope.
- Cookie-Editor v1.13.0, GPL-3.0, source `Moustachauve/cookie-editor` release zip.
- A provisioning failure must not block a browser launch.
- No changes to cookie/session storage or encryption.

## Review Focus

- Missing/corrupt bundled addon: profile still launches.
- Upgraded addon version: stale copy is replaced.
- Existing profile with cookies: restart keeps them.

---

### Task 1: Provision the bundled addon

**Files:**
- Create: `electron/extension-runtime.mjs`
- Create: `tests/unit/extension-runtime.test.ts`
- Create: `assets/extensions/cookie-editor-firefox/` (official 1.13.0 files + LICENSE)

**Interfaces:**
- Produces: `ensureCookieEditor(root: string, source?: string): Promise<string | undefined>`
- Produces: `cookieEditorSource: string`

- [ ] **Step 1: Write the failing test**

```ts
import { expect, test } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureCookieEditor } from '../../electron/extension-runtime.mjs';

async function addon(dir: string, version: string) {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ name: 'Cookie-Editor', version }));
  await writeFile(join(dir, 'marker.txt'), version);
}

test('copies the bundled addon into the data root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workspace-extension-'));
  const source = await mkdtemp(join(tmpdir(), 'workspace-extension-src-'));
  await addon(source, '1.13.0');
  const target = await ensureCookieEditor(root, source);
  expect(target).toBe(join(root, 'extensions', 'cookie-editor-firefox'));
  expect(await readFile(join(target!, 'marker.txt'), 'utf8')).toBe('1.13.0');
});

test('replaces a stale copy when the bundled version changes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workspace-extension-'));
  const source = await mkdtemp(join(tmpdir(), 'workspace-extension-src-'));
  await addon(source, '1.13.0');
  await ensureCookieEditor(root, source);
  await writeFile(join(source, 'manifest.json'), JSON.stringify({ version: '1.14.0' }));
  await writeFile(join(source, 'marker.txt'), '1.14.0');
  await ensureCookieEditor(root, source);
  const files = await readdir(join(root, 'extensions', 'cookie-editor-firefox'));
  expect(files).not.toContain('marker.txt.tmp');
  expect(await readFile(join(root, 'extensions', 'cookie-editor-firefox', 'marker.txt'), 'utf8')).toBe('1.14.0');
});

test('returns undefined when the source addon is missing', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workspace-extension-'));
  expect(await ensureCookieEditor(root, join(root, 'missing'))).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/extension-runtime.test.ts`
Expected: FAIL — cannot resolve `electron/extension-runtime.mjs`.

- [ ] **Step 3: Implement `ensureCookieEditor`**

Compare `manifest.json` versions; copy to a temp sibling then rename over the
target; on any error return the existing valid target or `undefined`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/extension-runtime.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add electron/extension-runtime.mjs tests/unit/extension-runtime.test.ts assets/extensions
git commit -m "feat: bundle Cookie-Editor Firefox addon"
```

### Task 2: Load it in every Camoufox launch

**Files:**
- Modify: `electron/camoufox-worker.mjs`
- Modify: `scripts/copy-runtime.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `ensureCookieEditor(root)` from Task 1.

- [ ] **Step 1: Wire the worker**

In `openContext`, before `launchOptions`, call
`const addon = await ensureCookieEditor(root);` and add
`addons: addon ? [addon] : [],` to the options object.

- [ ] **Step 2: Copy and unpack the new module**

Add `copyFileSync('electron/extension-runtime.mjs', 'dist-electron/electron/extension-runtime.mjs')`
to `scripts/copy-runtime.cjs`; add
`"assets/extensions/**"` and `"dist-electron/electron/extension-runtime.mjs"`
to `build.asarUnpack`.

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: exit code 0.

- [ ] **Step 4: Commit**

```bash
git add electron/camoufox-worker.mjs scripts/copy-runtime.cjs package.json
git commit -m "feat: enable Cookie-Editor in every Camoufox profile"
```

### Task 3: Prove the addon is installed and cookies survive

**Files:**
- Modify: `tests/native/camoufox.spec.ts`

**Interfaces:**
- Consumes: launched Camoufox profile under `<data>/camoufox/<id>/browser`.

- [ ] **Step 1: Add the assertion**

After the first profile reaches `running`, poll
`<data>/camoufox/<id>/browser/extension-preferences.json` until it contains
`{c3c10168-4186-445c-9c5b-63f12b8e2c87}`.

- [ ] **Step 2: Run the native suite**

Run: `npm run test:native -- --grep "preserve identity"`
Expected: PASS; the existing restart assertions still show `native_sid` and
`session_sid` cookies.
