import { expect, test } from 'vitest';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cookieEditorSource, ensureCookieEditor } from '../../electron/extension-runtime.mjs';

async function addon(dir: string, version: string): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'manifest.json'), JSON.stringify({ name: 'Cookie-Editor', version }));
  await writeFile(join(dir, 'marker.txt'), version);
}
async function root(): Promise<string> { return mkdtemp(join(tmpdir(), 'workspace-extension-')); }
async function source(): Promise<string> { return mkdtemp(join(tmpdir(), 'workspace-extension-src-')); }

test('bundled addon is Cookie-Editor 1.13.0 for Firefox', async () => {
  const manifest = JSON.parse(await readFile(join(cookieEditorSource, 'manifest.json'), 'utf8'));
  expect(manifest.name).toBe('Cookie-Editor');
  expect(manifest.version).toBe('1.13.0');
  expect(manifest.browser_specific_settings.gecko.id).toBe('{c3c10168-4186-445c-9c5b-63f12b8e2c87}');
});

test('copies the bundled addon into the data root', async () => {
  const data = await root(), bundled = await source();
  await addon(bundled, '1.13.0');
  const target = await ensureCookieEditor(data, bundled);
  expect(target).toBe(join(data, 'extensions', 'cookie-editor-firefox'));
  expect(await readFile(join(target!, 'marker.txt'), 'utf8')).toBe('1.13.0');
});

test('replaces a stale copy when the bundled version changes', async () => {
  const data = await root(), bundled = await source();
  await addon(bundled, '1.13.0');
  await ensureCookieEditor(data, bundled);
  await writeFile(join(bundled, 'manifest.json'), JSON.stringify({ name: 'Cookie-Editor', version: '1.14.0' }));
  await writeFile(join(bundled, 'marker.txt'), '1.14.0');
  const target = await ensureCookieEditor(data, bundled);
  expect(target).toBe(join(data, 'extensions', 'cookie-editor-firefox'));
  expect(await readFile(join(target!, 'marker.txt'), 'utf8')).toBe('1.14.0');
  expect(await readdir(join(data, 'extensions'))).toEqual(['cookie-editor-firefox']);
});

test('returns undefined when the source addon is missing', async () => {
  const data = await root();
  expect(await ensureCookieEditor(data, join(data, 'missing'))).toBeUndefined();
});
