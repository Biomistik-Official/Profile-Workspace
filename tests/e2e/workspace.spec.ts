import { _electron as electron, test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
let app: ElectronApplication; let data: string;
test.beforeEach(async () => { data = await mkdtemp(join(tmpdir(), 'workspace-ui-')); const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE; app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } }); });
test.afterEach(async () => { await app?.close(); await rm(data, { recursive: true, force: true }); });

test('edits persistent groups independently of profiles and offers empty groups in profile forms', async () => {
  const page = await app.firstWindow();
  await page.getByRole('button', { name: 'Группы', exact: true }).click();
  await page.getByRole('button', { name: 'Новая группа', exact: true }).click();
  await page.getByLabel('Название группы', { exact: true }).fill('Заранее');
  await page.getByRole('dialog').getByRole('button', { name: 'Создать группу', exact: true }).click();
  await expect(page.locator('.group-card')).toContainText('Заранее');
  await page.reload();
  await expect(page.locator('.sidebar-groups')).toContainText('Заранее');
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.getByLabel('Название профиля').fill('Group test');
  await page.getByRole('dialog').getByRole('button', { name: 'Заранее', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Группы', exact: true }).click();
  await page.getByRole('button', { name: 'Переименовать группу Заранее', exact: true }).click();
  await page.getByLabel('Название группы', { exact: true }).fill('Работа');
  await page.getByRole('button', { name: 'Сохранить группу', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).profiles[0].tags)).toEqual(['Работа']);
  await page.evaluate(async () => { const p = (await window.workspace.snapshot()).profiles[0]; await window.workspace.saveProfile({ ...p, tags: [] }); });
  await page.reload();
  await expect(page.locator('.sidebar-groups')).toContainText('Работа');
  await page.getByRole('button', { name: 'Группы', exact: true }).click();
  await expect(page.locator('.group-card')).toContainText('0 профилей');
  await expect(page.getByRole('button', { name: 'Группы', exact: true })).toHaveAttribute('aria-current', 'page');
  await page.mouse.move(1100, 700);
  await page.screenshot({ path: 'docs/design/workspace-2.0.1-groups.png' });
  await page.getByRole('button', { name: 'Удалить группу Работа', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить группу', exact: true }).click();
  await expect(page.locator('.group-card')).toHaveCount(0);
  await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).profiles.length)).toBe(1);
});

test('naturally orders numeric and mixed profile names after filtering', async () => {
  const page = await app.firstWindow();
  await page.evaluate(async () => { for (const name of ['12', '2', '11', '1', '10', '3', 'Profile 10', 'Profile 2']) await window.workspace.saveProfile({ name, notes: 'sorting' }); });
  await expect(page.locator('.profile-name strong')).toHaveText(['1', '2', '3', '10', '11', '12', 'Profile 2', 'Profile 10']);
  await page.getByLabel('Найти профиль').fill('Profile');
  await expect(page.locator('.profile-name strong')).toHaveText(['Profile 2', 'Profile 10']);
});

test('keeps all table columns inside the viewport with detail open at breakpoint boundaries', async () => {
  const page = await app.firstWindow();
  await page.evaluate(() => window.workspace.saveProfile({ name: 'Layout', notes: 'Заметка всегда видна', tags: ['SC Creators', 'Мой'] }));
  await page.getByRole('button', { name: 'Открыть профиль Layout', exact: true }).click();
  for (const width of [900, 1024, 1360, 1440, 1599, 1600, 1920]) {
    await page.setViewportSize({ width, height: 940 });
    await expect.poll(() => page.locator('.table-header').evaluate(el => el.scrollWidth <= el.clientWidth + 1), { message: `All columns fit at ${width}px` }).toBe(true);
    await expect.poll(() => page.locator('.main-content').evaluate(el => el.scrollWidth <= el.clientWidth + 1), { message: `No horizontal scrolling at ${width}px` }).toBe(true);
  }
});

test('picks existing tags without losing typed tags in create edit and bulk forms', async () => {
  const page = await app.firstWindow();
  await page.evaluate(() => window.workspace.saveProfile({ name: 'Source', tags: ['Мой', 'SC Creators'] }));
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.getByLabel('Название профиля').fill('Tagged');
  await page.getByLabel('Теги через запятую', { exact: true }).fill('Custom');
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'SC Creators', exact: true }).click();
  await expect(dialog.getByRole('button', { name: 'SC Creators', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog).toBeVisible();
  await page.getByLabel('Заметка', { exact: true }).fill('Visible note');
  await dialog.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Tagged')?.tags)).toEqual(['Custom', 'SC Creators']);
  await page.getByRole('button', { name: 'Настройки Tagged', exact: true }).click();
  await dialog.getByRole('button', { name: 'SC Creators', exact: true }).click();
  await dialog.getByRole('button', { name: 'Мой', exact: true }).click();
  await dialog.getByRole('button', { name: 'Сохранить изменения', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Tagged')?.tags)).toEqual(['Custom', 'Мой']);
  await page.getByRole('checkbox', { name: 'Выбрать Tagged', exact: true }).check();
  await page.getByRole('button', { name: 'Изменить', exact: true }).click();
  await dialog.getByRole('button', { name: 'SC Creators', exact: true }).click();
  await dialog.getByRole('button', { name: 'Применить изменения', exact: true }).click();
  await expect.poll(() => page.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Tagged')?.tags)).toEqual(['SC Creators']);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Открыть профиль Tagged', exact: true })).toBeVisible();
});

test('keeps full multiline notes visible alongside errors without overlapping measured rows', async () => {
  const page = await app.firstWindow();
  const note = 'Всегда видимая заметка '.repeat(24) + '\nПоследняя строка';
  await page.evaluate(async note => {
    await window.workspace.saveProxy({ name: 'Closed local port', protocol: 'http', host: '127.0.0.1', port: 1 });
    const proxy = (await window.workspace.snapshot()).proxies[0];
    await window.workspace.saveProfile({ name: '1', notes: note, proxyId: proxy.id });
    await window.workspace.saveProfile({ name: '2', notes: 'Следующий профиль' });
    const snapshot = await window.workspace.snapshot();
    await window.workspace.launch([snapshot.profiles.find(p => p.name === '1')!.id]);
  }, note);
  await page.setViewportSize({ width: 1024, height: 768 });
  const first = page.locator('.profile-row').filter({ has: page.getByRole('button', { name: 'Открыть профиль 1', exact: true }) });
  await expect(first.locator('.profile-note')).toHaveText(note);
  await expect(first.locator('.profile-error')).toBeVisible();
  expect(await first.locator('.profile-note').evaluate(el => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  const second = page.locator('.profile-row').filter({ has: page.getByRole('button', { name: 'Открыть профиль 2', exact: true }) });
  await expect.poll(async () => {
    const a = await first.boundingBox(); const b = await second.boundingBox();
    return !!a && !!b && a.y + a.height <= b.y + 1;
  }).toBe(true);
});
test('creates, edits, filters and selects real persisted profiles through the interface', async () => {
  const page = await app.firstWindow();
  await expect(page.getByText('Создайте первый профиль')).toBeVisible();
  await page.getByRole('button', { name: 'Новый профиль', exact: true }).click();
  await page.getByLabel('Название профиля').fill('Рабочий');
  await page.getByLabel('Движок браузера', { exact: true }).selectOption('chromium');
  await page.getByLabel('Теги через запятую').fill('Работа, Основной');
  await page.getByLabel('Заметка').fill('Сессия для работы');
  await page.getByRole('dialog').getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Открыть профиль Рабочий' })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть профиль Рабочий' }).click();
  await page.getByRole('tab', { name: 'Cookies', exact: true }).click();
  await expect(page.getByText('Пока нет cookies')).toBeVisible();
  await page.getByPlaceholder('Найти по имени, тегу или заметке').fill('несуществующий');
  await expect(page.getByText('Ничего не найдено')).toBeVisible();
  await page.getByPlaceholder('Найти по имени, тегу или заметке').fill('Основной');
  await expect(page.getByRole('button', { name: 'Открыть профиль Рабочий' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Выбрать Рабочий' }).check();
  await expect(page.getByText('Выбрано: 1')).toBeVisible();
  await page.screenshot({ path: 'test-results/workspace-1440.png' });
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: 'test-results/workspace-1024.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Закрыть панель профиля' }).click();
  await page.getByRole('button', { name: 'Открыть профиль Рабочий' }).click();
  await page.getByRole('tab', { name: 'Настройки', exact: true }).click();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.getByLabel('Название профиля').fill('Рабочий обновлён');
  await page.getByRole('dialog').getByRole('button', { name: 'Сохранить изменения' }).click();
  await expect(page.getByRole('button', { name: 'Открыть профиль Рабочий обновлён' })).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть панель профиля' }).click();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Обновления приложения' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Проверить обновления' })).toBeDisabled();
  await expect(page.evaluate(() => window.workspace.closeToUpdate())).rejects.toThrow('Обновление ещё не загружено');
  await page.getByLabel('Параллельных запусков').fill('5');
  await page.getByRole('button', { name: 'Сохранить настройки' }).click();
  await expect(page.getByText('Настройки сохранены.')).toBeVisible();
  expect(await page.evaluate(async () => (await window.workspace.snapshot()).settings.maxConcurrent)).toBe(5);
});

test('cookie import preview accepts valid records and prevents an empty replacement through the interface', async () => {
  const page = await app.firstWindow();
  await page.evaluate(() => window.workspace.saveProfile({ name: 'Cookie workflow', restoreSessionCookies: true }));
  const file = join(data, 'cookies.json');
  await writeFile(file, JSON.stringify([{ domain: 'example.com', name: 'sid', value: 'ui-session', httpOnly: true }]));
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
  await page.getByRole('button', { name: 'Открыть профиль Cookie workflow' }).click();
  await page.getByRole('tab', { name: 'Cookies', exact: true }).click();
  await page.getByRole('button', { name: 'Импорт', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Проверка импорта cookies' })).toBeVisible();
  await page.getByRole('button', { name: 'Импортировать cookies', exact: true }).click();
  await expect(page.locator('.domain-group').getByText('example.com')).toBeVisible();
  await page.locator('.domain-group summary').click();
  await expect(page.locator('.cookie-entry').getByText('sid', { exact: true })).toBeVisible();
  await expect(page.locator('.cookie-entry code')).not.toContainText('ui-session');
  await page.getByRole('button', { name: 'Показать значение sid' }).click();
  await expect(page.locator('.cookie-entry code')).toContainText('ui-session');
  await writeFile(file, '[]');
  await page.getByRole('button', { name: 'Импорт', exact: true }).click();
  await page.getByLabel('Режим импорта').selectOption('replace');
  await expect(page.getByRole('button', { name: 'Импортировать cookies', exact: true })).toBeDisabled();
  await expect(page.getByText('Нет валидных cookies. Текущие данные не будут изменены.')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Отмена', exact: true }).click();
  expect(await page.locator('dialog').count()).toBe(1);
  await expect(page.locator('dialog')).toHaveCount(0);
  expect(await page.evaluate(async () => (await window.workspace.cookies((await window.workspace.snapshot()).profiles[0].id)).map(c => c.name))).toEqual(['sid']);
});
