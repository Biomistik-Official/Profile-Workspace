import { existsSync } from 'node:fs';
import { cp, mkdir, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The worker runs from dist-electron/electron in development and release, but
// unit tests import this file from electron/. Accept both layouts.
const candidates = [
  fileURLToPath(new URL('../../assets/extensions/cookie-editor-firefox', import.meta.url)),
  fileURLToPath(new URL('../assets/extensions/cookie-editor-firefox', import.meta.url)),
];
export const cookieEditorSource = candidates.find(path => existsSync(join(path, 'manifest.json'))) ?? candidates[0];

const provisioning = new Map();

async function version(dir) {
  try {
    const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
    return typeof manifest.version === 'string' ? manifest.version : '';
  } catch { return ''; }
}

async function provision(root, source) {
  const target = join(root, 'extensions', 'cookie-editor-firefox');
  const wanted = await version(source);
  if (!wanted) return existsSync(join(target, 'manifest.json')) ? target : undefined;
  if (await version(target) === wanted) return target;
  const staging = `${target}.tmp`;
  try {
    await mkdir(join(root, 'extensions'), { recursive: true });
    await rm(staging, { recursive: true, force: true });
    await cp(source, staging, { recursive: true });
    await rm(target, { recursive: true, force: true });
    await rename(staging, target);
    return target;
  } catch {
    await rm(staging, { recursive: true, force: true }).catch(() => {});
    return existsSync(join(target, 'manifest.json')) ? target : undefined;
  }
}

/**
 * Copies the bundled Cookie-Editor addon into the app data root and returns the
 * folder Camoufox should load. Concurrent native launches share one provision,
 * and a broken bundle returns undefined so the browser still opens.
 */
export function ensureCookieEditor(root, source = cookieEditorSource) {
  const key = `${root}\0${source}`;
  const existing = provisioning.get(key);
  if (existing) return existing;
  const task = provision(root, source).finally(() => provisioning.delete(key));
  provisioning.set(key, task);
  return task;
}
