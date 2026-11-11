import { _electron as electron, expect, test } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('new profiles expose native settings and legacy accounts retain their fixed engine', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-engine-ui-'));
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const page = await app.firstWindow();
    await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
    await expect(page.getByLabel('Движок браузера', { exact: true })).toHaveValue('camoufox');
    await page.getByLabel('Название профиля').fill('Native UI');
    await page.getByLabel('Язык браузера', { exact: true }).selectOption('ru-RU');
    await page.getByLabel('Часовой пояс IANA').fill('Europe/Berlin');
    await page.getByRole('dialog').getByRole('button', { name: 'Создать профиль', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).profiles[0])).toMatchObject({ engine: 'camoufox', nativeSettings: { locale: 'ru-RU', timezone: 'Europe/Berlin' } });
    await page.evaluate(() => window.workspace.saveProfile({ name: 'Existing account' }));
    await page.getByRole('button', { name: 'Настройки Existing account', exact: true }).click();
    await expect(page.getByLabel('Движок браузера', { exact: true })).toHaveValue('chromium');
    await expect(page.getByLabel('Движок браузера', { exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Отмена', exact: true }).click();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Движок Camoufox', exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).engine?.status)).not.toBe('checking');
    await page.getByLabel('Название закладки', { exact: true }).fill('Общая рабочая');
    await page.getByLabel('Адрес закладки', { exact: true }).fill('https://example.org/shared');
    await page.getByRole('button', { name: 'Добавить закладку', exact: true }).click();
    await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).sites.map(s => s.name))).toContain('Общая рабочая');
    await page.reload();
    await page.getByRole('button', { name: 'Настройки', exact: true }).click();
    await expect(page.locator('.shared-bookmarks')).toContainText('Общая рабочая');
  } finally { await app.close(); await rm(data, { recursive: true, force: true }); }
});
