import { _electron as electron, test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('profile parameters apply before first script and request, survive restart and reach OAuth child tabs', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-fingerprint-')); const headers: string[] = [];
  const server = createServer((req, res) => {
    headers.push(String(req.headers['user-agent'])); res.setHeader('Content-Type', 'text/html');
    res.end(`<script>window.observed={language:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,width:screen.width,height:screen.height,cores:navigator.hardwareConcurrency,ua:navigator.userAgent};</script><button onclick="window.open('/popup','oauth')">Popup</button>`);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const manager = await app.firstWindow();
    const id = await manager.evaluate(async url => {
      const fingerprint = { ...await window.workspace.generateFingerprint(), language: 'nl-NL', timezone: 'Europe/Amsterdam', screenWidth: 1920, screenHeight: 1080, hardwareConcurrency: 4, userAgent: 'ProfileWorkspace-Test/1.0' };
      await window.workspace.saveProfile({ name: 'Parameters', startUrl: url, fingerprint });
      const s = await window.workspace.snapshot(); await window.workspace.launch([s.profiles[0].id]); return s.profiles[0].id;
    }, origin + '/start');
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
    const parent = app.windows().find(w => w.url() === origin + '/start')!;
    const expected = { language: 'nl-NL', timezone: 'Europe/Amsterdam', width: 1920, height: 1080, cores: 4, ua: 'ProfileWorkspace-Test/1.0' };
    expect(await parent.evaluate(() => (window as any).observed)).toEqual(expected);
    expect(headers[0]).toBe(expected.ua);
    await parent.getByRole('button', { name: 'Popup' }).click();
    await expect.poll(() => app.windows().some(w => w.url() === origin + '/popup')).toBe(true);
    const popup = app.windows().find(w => w.url() === origin + '/popup')!;
    expect(await popup.evaluate(() => (window as any).observed)).toEqual(expected);
    expect(await popup.evaluate(() => !!window.opener)).toBe(true);
    await manager.evaluate(id => window.workspace.stop([id]), id);
    await manager.evaluate(id => window.workspace.launch([id]), id);
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
    const restarted = app.windows().find(w => w.url() === origin + '/start')!;
    expect(await restarted.evaluate(() => (window as any).observed)).toEqual(expected);
    await manager.evaluate(async id => {
      await window.workspace.stop([id]); const profile = (await window.workspace.snapshot()).profiles.find(p => p.id === id)!;
      await window.workspace.saveProfile({ ...profile, fingerprint: { ...profile.fingerprint!, userAgent: '' } });
      await window.workspace.launch([id]);
    }, id);
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
    const automatic = app.windows().find(w => w.url() === origin + '/start')!;
    const actual = await automatic.evaluate(() => (window as any).observed);
    expect(actual.ua).toContain('Chrome/'); expect(actual.ua).not.toMatch(/Electron|ProfileWorkspace|Profile-Workspace/i);
    await manager.evaluate(async id => { await window.workspace.stop([id]); await window.workspace.duplicateProfile(id); }, id);
    const fingerprints = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles.map(p => p.fingerprint));
    expect(fingerprints[0]).not.toEqual(fingerprints[1]);
  } finally { await app.close(); await new Promise<void>(r => server.close(() => r())); await rm(data, { recursive: true, force: true }); }
});

test('profile form regenerates a draft and persists manual browser parameters', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-fingerprint-ui-'));
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
    await page.getByLabel('Название профиля').fill('UI parameters');
    await expect(page.getByLabel('Язык браузера')).not.toHaveValue('');
    await page.getByRole('button', { name: 'Сгенерировать новый', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Сгенерировать новый', exact: true })).toBeEnabled();
    await page.getByLabel('Язык браузера').fill('en-GB'); await page.getByLabel('Часовой пояс').fill('Europe/London');
    await page.getByLabel('Ширина экрана').fill('1600'); await page.getByLabel('Высота экрана').fill('900'); await page.getByLabel('Логических ядер').fill('8');
    await page.getByRole('dialog').getByRole('button', { name: 'Создать профиль', exact: true }).click();
    await page.getByRole('button', { name: 'Настройки UI parameters', exact: true }).click();
    await expect(page.getByLabel('Ширина экрана')).toHaveValue('1600'); await expect(page.getByLabel('Часовой пояс')).toHaveValue('Europe/London');
    await page.getByLabel('Язык браузера').scrollIntoViewIfNeeded();
    await page.screenshot({ path: 'test-results/profile-fingerprint-form.png' });
    const fp = await page.evaluate(async () => (await window.workspace.snapshot()).profiles[0].fingerprint);
    expect(fp).toMatchObject({ language: 'en-GB', timezone: 'Europe/London', screenWidth: 1600, screenHeight: 900, hardwareConcurrency: 8 });
  } finally { await app.close(); await rm(data, { recursive: true, force: true }); }
});
