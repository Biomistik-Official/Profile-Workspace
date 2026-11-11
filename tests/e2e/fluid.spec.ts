import { _electron as electron, test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let application: ElectronApplication;
let directory: string;
test.beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'workspace-fluid-'));
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  application = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: directory } });
});
test.afterEach(async () => { await application?.close(); await rm(directory, { recursive: true, force: true }); });

test('opening details and selecting rows keeps navigation and table geometry stable', async () => {
  const page = await application.firstWindow();
  await page.setViewportSize({ width: 1440, height: 940 });
  await page.evaluate(async () => {
    await window.workspace.saveProfile({ name: 'Рабочий', notes: 'Основной профиль · публикации и сообщения', tags: ['Работа'] });
    await window.workspace.saveProfile({ name: 'Исследования', notes: 'Материалы и сохранённые источники', tags: ['Личное'] });
    await window.workspace.saveProfile({ name: 'Тестирование', notes: 'Проверка новых сценариев' });
  });
  const sidebar = await page.locator('.sidebar').boundingBox();
  const table = await page.locator('.profile-table').boundingBox();
  await page.screenshot({ path: 'docs/design/workspace-vesper-profiles.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Открыть профиль Рабочий', exact: true }).click();
  await expect(page.locator('.profile-detail')).toBeVisible();
  expect(await page.locator('.sidebar').boundingBox()).toEqual(sidebar);
  expect(await page.locator('.profile-table').boundingBox()).toEqual(table);
  await page.screenshot({ path: 'docs/design/workspace-vesper-detail.png', animations: 'disabled' });
  await page.getByRole('button', { name: 'Закрыть панель профиля' }).click();
  await expect(page.locator('.profile-detail')).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Выбрать Рабочий', exact: true }).check();
  expect(await page.locator('.profile-table').boundingBox()).toEqual(table);
});

test('editor finishes its exit without accepting a second submit and restores focus', async () => {
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.getByLabel('Название профиля').fill('Не сохранять');
  await page.screenshot({ path: 'docs/design/workspace-vesper-editor.png', animations: 'disabled' });
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(await page.locator('dialog').count()).toBe(1);
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Новый профиль', exact: true })).toBeFocused();
  expect((await page.evaluate(() => window.workspace.snapshot())).profiles).toHaveLength(0);
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.getByLabel('Название профиля').fill('Один профиль');
  await page.getByRole('dialog').getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page.locator('dialog')).toHaveCount(0);
  expect((await page.evaluate(() => window.workspace.snapshot())).profiles).toHaveLength(1);
});

test('rapid navigation settles on the last destination and reduced motion skips overlay exits', async () => {
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Прокси', exact: true }).click();
  await page.evaluate(() => {
    for (const label of ['Группы', 'Настройки', 'Профили']) (document.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement).click();
  });
  await expect(page.getByRole('heading', { name: 'Профили', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Профили', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(await page.getByRole('dialog').count()).toBe(0);
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('dialog')).toHaveCount(0);
});

test('Ctrl K focuses profile search after navigating from another section', async () => {
  const page = await application.firstWindow();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Найти профиль' })).toBeFocused();
  await page.keyboard.type('Рабочий');
  await expect(page.getByRole('textbox', { name: 'Найти профиль' })).toHaveValue('Рабочий');
});
