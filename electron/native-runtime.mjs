import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, link, copyFile, readFile, writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { ensureCamoufoxInstalled, launchPath } from 'camoufox/dist/pkgman.js';
const require = createRequire(import.meta.url);
const library = JSON.parse(readFileSync(require.resolve('camoufox/package.json'), 'utf8'));
export const runtimeRoot = join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Profile Workspace', 'Engines', `camoufox-${library.version}`);
export const runtimeExecutable = join(runtimeRoot, 'camoufox.exe');
const marker = join(runtimeRoot, 'workspace-runtime.json');

export function runtimeStatus() {
  if (!existsSync(marker) || !existsSync(runtimeExecutable)) return { status: 'missing' };
  return { status: 'ready', version: JSON.parse(readFileSync(marker, 'utf8')).version };
}
async function linkTree(source, destination) {
  await mkdir(destination, { recursive: true });
  for (const item of await readdir(source, { withFileTypes: true })) {
    const from = join(source, item.name), to = join(destination, item.name);
    if (item.isDirectory()) await linkTree(from, to);
    else if (item.isFile()) {
      try { await link(from, to); } catch (error) {
        if (error.code === 'EEXIST') continue;
        if (['EXDEV', 'EPERM', 'ENOTSUP'].includes(error.code)) await copyFile(from, to); else throw error;
      }
    }
  }
}
let policyTail = Promise.resolve();
export function syncPolicies(sites) {
  const operation = policyTail.then(() => writePolicies(sites));
  policyTail = operation.catch(() => {}); return operation;
}
async function writePolicies(sites) {
  if (!existsSync(runtimeExecutable)) return;
  const folder = join(runtimeRoot, 'distribution'), file = join(folder, 'policies.json');
  await mkdir(folder, { recursive: true });
  let current = {};
  try { current = JSON.parse(await readFile(file, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const next = { ...current, policies: { ...current.policies, DisableAppUpdate: true,
    SearchEngines: { Default: 'Google', DefaultPrivate: 'Google', Remove: ['None', 'DuckDuckGo'],
      Add: [{ Name: 'Google', Description: 'Google', Alias: '@google', Method: 'GET', URLTemplate: 'https://www.google.com/search?q={searchTerms}' }] },
    DisplayBookmarksToolbar: 'always',
    Bookmarks: sites.map(site => ({ Title: site.name, URL: site.url, Placement: 'toolbar', Folder: 'Profile Workspace' })),
  } };
  const content = JSON.stringify(next, null, 2);
  if (JSON.stringify(current, null, 2) === content) return;
  // Atomic replacement breaks the initial hard link: the upstream cache is never edited.
  const temporary = `${file}.${process.pid}-${randomUUID()}.tmp`;
  await writeFile(temporary, content, { mode: 0o600 }); await rename(temporary, file);
}
export async function installRuntime(sites = []) {
  await ensureCamoufoxInstalled();
  if (!existsSync(marker)) {
    const source = dirname(launchPath()); await linkTree(source, runtimeRoot);
    await syncPolicies(sites);
    const version = JSON.parse(await readFile(join(source, 'version.json'), 'utf8'));
    await writeFile(marker, JSON.stringify({ version: `${version.version}-${version.release ?? version.build ?? version.tag}`, launcher: library.version }));
  } else await syncPolicies(sites);
  return runtimeStatus();
}
