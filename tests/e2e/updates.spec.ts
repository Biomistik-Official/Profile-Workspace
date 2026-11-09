import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('staged update waits for actual quit and cannot bypass failed session saving', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-update-quit-')); const marker = join(data, 'installer-called');
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const application = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  let closed = false;
  try {
    const manager = await application.firstWindow();
    await manager.evaluate(async () => { await window.workspace.saveProfile({ name: 'Update session', restoreSessionCookies: true }); });
    const id = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles[0].id);
    await manager.evaluate(id => window.workspace.cookies(id), id);
    await application.evaluate(async ({ app, session, safeStorage, dialog }, { id, marker }) => {
      const req = process.getBuiltinModule('module').createRequire(app.getAppPath() + '/package.json');
      const { autoUpdater } = req('electron-updater');
      autoUpdater.autoInstallOnAppQuit = true;
      autoUpdater.install = () => { process.getBuiltinModule('fs').writeFileSync(marker, 'installed-after-save'); return true; };
      autoUpdater.addQuitHandler();
      await session.fromPartition(`persist:profile-${id}`).cookies.set({ url: 'https://example.com/', name: 'session-fixture', value: 'synthetic' });
      (globalThis as any).__originalEncrypt = safeStorage.encryptStringAsync;
      safeStorage.encryptStringAsync = async () => { throw new Error('Synthetic save failure'); };
      (globalThis as any).__updateQuitErrors = [];
      dialog.showErrorBox = (title, message) => { (globalThis as any).__updateQuitErrors.push({ title, message }); };
      app.quit();
    }, { id, marker });
    await expect.poll(() => application.evaluate(() => (globalThis as any).__updateQuitErrors.length)).toBe(1);
    expect(await readFile(marker, 'utf8').catch(() => 'not-installed')).toBe('not-installed');
    expect(await manager.evaluate(() => window.workspace.snapshot()).then(s => s.profiles.length)).toBe(1);
    await application.evaluate(({ safeStorage }) => { safeStorage.encryptStringAsync = (globalThis as any).__originalEncrypt; });
    await application.close(); closed = true;
    expect(await readFile(marker, 'utf8')).toBe('installed-after-save');
  } finally {
    if (!closed) { await application.evaluate(({ safeStorage }) => { if ((globalThis as any).__originalEncrypt) safeStorage.encryptStringAsync = (globalThis as any).__originalEncrypt; }).catch(() => {}); await application.close(); }
    await rm(data, { recursive: true, force: true });
  }
});
