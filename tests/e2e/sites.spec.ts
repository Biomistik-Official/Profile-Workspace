import { _electron as electron, test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';

test('browser left drawer persists sites and opens isolated tabs without covering the panel', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-sites-'));
  const server = createServer((_req, res) => res.end('<title>Local site</title>Site'));
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const manager = await app.firstWindow();
    await manager.evaluate(async url => {
      await window.workspace.saveProfile({ name: 'Sites profile', startUrl: url });
      await window.workspace.launch([(await window.workspace.snapshot()).profiles[0].id]);
    }, url);
    await expect.poll(() => app.windows().some(w => w.url().includes('mode=browser'))).toBe(true);
    const browser = app.windows().find(w => w.url().includes('mode=browser'))!;
    await browser.getByRole('button', { name: 'Сайты', exact: true }).click();
    const panel = browser.getByRole('complementary', { name: 'Сайты' });
    for (const name of ['Twitch', 'TikTok', 'YouTube', 'Instagram', 'Supercell Creators']) {
      await expect(panel.getByRole('button', { name: `Открыть ${name}`, exact: true })).toBeVisible();
    }
    await panel.getByLabel('Название сайта').fill('Мой сайт');
    await panel.getByLabel('Адрес сайта').fill(url + 'custom');
    await panel.getByRole('button', { name: 'Добавить сайт', exact: true }).click();
    await panel.getByRole('button', { name: 'Открыть Мой сайт', exact: true }).click();
    await expect.poll(() => browser.evaluate(async () => (await window.browser.state()).tabs.length)).toBe(2);
    await expect.poll(() => browser.evaluate(async () => (await window.browser.state()).tabs.at(-1)?.url)).toBe(url + 'custom');
    const bounds = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().flatMap(w => w.contentView.children.map(v => v.getBounds())).filter(b => b.y === 98));
    expect(bounds.length).toBe(2); expect(bounds.every(b => b.x === 300)).toBe(true);
    await panel.evaluate(el => { el.scrollTop = 0; });
    await browser.screenshot({ path: 'test-results/browser-sites.png' });
    await browser.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(browser.getByRole('button', { name: 'Сайты', exact: true })).toBeFocused();
    await browser.reload();
    await browser.getByRole('button', { name: 'Сайты', exact: true }).click();
    await expect(panel.getByRole('button', { name: 'Открыть Мой сайт', exact: true })).toBeVisible();
    await expect(browser.evaluate(() => window.browser.openSite('file:///C:/Windows'))).rejects.toThrow();
    await panel.getByRole('button', { name: 'Удалить сайт Мой сайт' }).click();
    await expect(panel.getByRole('button', { name: 'Открыть Мой сайт', exact: true })).toHaveCount(0);
    await app.evaluate(({ dialog, webContents }, url) => {
      (globalThis as any).__sitesErrors = [];
      dialog.showErrorBox = (title, message) => { (globalThis as any).__sitesErrors.push({ title, message }); };
      webContents.getAllWebContents().find(w => w.getURL() === url + 'custom')!.close();
    }, url);
    await expect.poll(() => browser.evaluate(async () => (await window.browser.state()).tabs.length)).toBe(1);
    await manager.evaluate(async () => {
      const s = await window.workspace.snapshot(); await window.workspace.stop([s.profiles[0].id]);
    });
    expect(await app.evaluate(() => (globalThis as any).__sitesErrors)).toEqual([]);
  } finally { await app.close(); await new Promise<void>(r => server.close(() => r())); await rm(data, { recursive: true, force: true }); }
});
