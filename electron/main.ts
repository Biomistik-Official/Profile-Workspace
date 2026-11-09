import { app, BrowserWindow, dialog, ipcMain, Menu, net, safeStorage, session, shell, type Session, type IpcMainInvokeEvent } from 'electron';
import { join, basename } from 'node:path';
import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { WorkspaceStore } from '../core/store';
import { LaunchQueue } from '../core/queue';
import { parseCookies, serializeCookies } from '../core/cookies';
import type { CookieFormat, PortableCookie, ProfileDraft, ProxyCheck, ProxyDraft, RuntimeState, Settings, WorkspaceSnapshot } from '../shared/types';
import { ProfileBrowser } from './browser';
import { portableCookie, replaceOrMergeCookies } from './cookie-service';
import { startSocksBridge, type SocksBridge } from './socks-bridge';
import { autoUpdater } from 'electron-updater';
import { UpdateController } from './updates';

app.setName('Profile Workspace');
if (process.env.PROFILE_WORKSPACE_DATA_DIR) app.setPath('userData', process.env.PROFILE_WORKSPACE_DATA_DIR);
const dataRoot = app.getPath('userData');
const renderer = join(__dirname, '../../dist/index.html');
let manager: BrowserWindow;
let store: WorkspaceStore;
let quitting = false;
let updates: UpdateController | undefined;
const browsers = new Map<string, ProfileBrowser>();
const runtime: Record<string, RuntimeState> = {};
const proxyChecks: Record<string, ProxyCheck> = {};
const sessions = new Map<string, Session>();
const hydratedSessions = new Map<string, Promise<Session>>();
const mutations = new Set<string>();
const cancelledStarts = new Set<string>();
const sessionCredentials = new Map<Session, { host: string; port: number; username: string; password: string }>();
const socksBridges = new Map<Session, SocksBridge>();
const cookiePreviews = new Map<string, { profileId: string; cookies: PortableCookie[]; createdAt: number }>();
const loginAttempts = new Map<number, number>();
const queue = new LaunchQueue(startProfile, publish);

function snapshot(): WorkspaceSnapshot {
  const state = store.snapshot();
  const states = { ...runtime };
  for (const id of queue.pendingIds()) states[id] = { status: 'queued' };
  return { ...state, runtime: states, proxyChecks: { ...proxyChecks }, queue: queue.state(), dataPath: dataRoot, version: app.getVersion(), update: updates?.snapshot() };
}
function publish(): void { if (store && manager && !manager.isDestroyed()) manager.webContents.send('workspace:changed', snapshot()); }
function ids(input: unknown): string[] {
  if (!Array.isArray(input) || input.some(id => typeof id !== 'string')) throw new Error('Неверный список профилей.');
  const unique = [...new Set(input as string[])]; unique.forEach(id => store.profile(id)); return unique;
}
function assertStopped(id: string): void {
  store.profile(id);
  if (browsers.has(id) || queue.contains(id) || ['starting', 'stopping'].includes(runtime[id]?.status)) throw new Error('Сначала остановите профиль и уберите его из очереди.');
}
async function locked<T>(id: string, fn: () => Promise<T>): Promise<T> {
  assertStopped(id);
  if (mutations.has(id)) throw new Error('С этим профилем уже выполняется операция.');
  mutations.add(id);
  try { return await fn(); } finally { mutations.delete(id); publish(); }
}
async function lockedProfiles<T>(list: string[], fn: () => Promise<T>): Promise<T> {
  list.forEach(assertStopped);
  if (list.some(id => mutations.has(id))) throw new Error('С профилем уже выполняется операция.');
  list.forEach(id => mutations.add(id));
  try { return await fn(); } finally { list.forEach(id => mutations.delete(id)); publish(); }
}
async function encrypt(value: string): Promise<string> {
  if (!await safeStorage.isAsyncEncryptionAvailable()) throw new Error('Шифрование Windows недоступно. Секрет не сохранён.');
  return (await safeStorage.encryptStringAsync(value)).toString('base64');
}
async function decrypt(value: string): Promise<string> { return (await safeStorage.decryptStringAsync(Buffer.from(value, 'base64'))).result; }
function profileSession(id: string): Session {
  store.profile(id);
  let ses = sessions.get(id);
  if (!ses) {
    ses = session.fromPartition(`persist:profile-${id}`);
    const ua = ses.getUserAgent().replace(/\sElectron\/\S+/g, '').replace(/\sprofile-workspace\/\S+/gi, '');
    ses.setUserAgent(ua);
    ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on('will-download', (_event, item) => item.setSaveDialogOptions({ title: 'Сохранить файл', defaultPath: item.getFilename() }));
    sessions.set(id, ses);
  }
  return ses;
}
async function releaseProxy(ses: Session): Promise<void> {
  const bridge = socksBridges.get(ses); socksBridges.delete(ses); sessionCredentials.delete(ses);
  try { await ses.closeAllConnections(); } finally { await bridge?.close(); }
}
async function configureProxy(ses: Session, proxyId: string | null): Promise<void> {
  await releaseProxy(ses);
  if (!proxyId) { await ses.setProxy({ mode: 'direct' }); return; }
  const p = store.proxy(proxyId); const credentials = await store.proxyCredentials(proxyId);
  if (p.protocol === 'socks5' && (credentials.username || credentials.password)) {
    const bridge = await startSocksBridge(p, credentials); socksBridges.set(ses, bridge);
    try {
      await ses.setProxy({ mode: 'fixed_servers', proxyRules: bridge.proxyRules, proxyBypassRules: '<-loopback>' });
      sessionCredentials.set(ses, bridge.credentials);
    } catch (e) { await releaseProxy(ses); throw e; }
    return;
  }
  await ses.setProxy({ mode: 'fixed_servers', proxyRules: `${p.protocol}://${p.host}:${p.port}`, proxyBypassRules: '<-loopback>' });
  sessionCredentials.set(ses, { host: p.host.replace(/^\[|\]$/g, ''), port: p.port, ...credentials });
}
async function probeProxy(ses: Session): Promise<string> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url: 'https://api.ipify.org?format=json', session: ses, useSessionCookies: false, redirect: 'error' });
    let attempts = 0;
    const timer = setTimeout(() => { request.abort(); reject(new Error('Прокси не ответил за 12 секунд.')); }, 12000);
    request.on('login', (auth, callback) => {
      const c = sessionCredentials.get(ses);
      if (auth.isProxy && c && auth.host === c.host && auth.port === c.port && attempts++ === 0) callback(c.username, c.password);
      else callback();
    });
    request.on('response', response => {
      let body = '';
      response.on('data', chunk => { body += chunk.toString(); if (body.length > 65536) request.abort(); });
      response.on('end', () => {
        clearTimeout(timer);
        try { const ip = JSON.parse(body).ip; if (response.statusCode !== 200 || typeof ip !== 'string' || !/^[\da-fA-F:.]+$/.test(ip)) throw new Error(); resolve(ip); }
        catch { reject(new Error('Не удалось проверить IP через прокси. Проверьте адрес и авторизацию.')); }
      });
      response.on('error', () => { clearTimeout(timer); reject(new Error('Прокси прервал соединение.')); });
    });
    request.on('error', () => { clearTimeout(timer); reject(new Error('Прокси недоступен или отклонил авторизацию. Прямое соединение не использовано.')); });
    request.end();
  });
}
async function saveSessionCookies(id: string, ses: Session, ending = false): Promise<void> {
  ses.flushStorageData(); await ses.cookies.flushStore();
  const file = join(dataRoot, 'session-cookies', `${id}.enc`);
  const cookies = (await ses.cookies.get({})).filter(c => c.session).map(portableCookie);
  if (store.profile(id).restoreSessionCookies && cookies.length) {
    await mkdir(join(dataRoot, 'session-cookies'), { recursive: true });
    await writeFile(`${file}.tmp`, await encrypt(JSON.stringify(cookies)), { mode: 0o600 });
    await rename(`${file}.tmp`, file);
  } else await rm(file, { force: true });
  if (ending && !store.profile(id).restoreSessionCookies) {
    for (const c of cookies) await ses.cookies.remove(`${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path}`, c.name);
    await ses.cookies.flushStore();
  }
}
async function restoreSessionCookies(id: string, ses: Session): Promise<void> {
  if (!store.profile(id).restoreSessionCookies) return;
  let raw: string;
  try { raw = await readFile(join(dataRoot, 'session-cookies', `${id}.enc`), 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
  const parsed = parseCookies(await decrypt(raw));
  if (parsed.cookies.length) await replaceOrMergeCookies(ses, parsed.cookies, 'merge');
}
async function readySession(id: string): Promise<Session> {
  const existing = hydratedSessions.get(id);
  if (existing) return existing;
  const promise = (async () => { const ses = profileSession(id); await restoreSessionCookies(id, ses); return ses; })();
  hydratedSessions.set(id, promise);
  try { return await promise; } catch (e) { hydratedSessions.delete(id); throw e; }
}
async function startProfile(id: string): Promise<void> {
  if (browsers.has(id)) { browsers.get(id)!.window.focus(); return; }
  if (mutations.has(id)) { runtime[id] = { status: 'error', error: 'Дождитесь завершения операции с профилем.' }; publish(); return; }
  runtime[id] = { status: 'starting' }; cancelledStarts.delete(id); publish();
  try {
    const profile = store.profile(id); const ses = await readySession(id);
    await configureProxy(ses, profile.proxyId);
    if (profile.proxyId) {
      const ip = await probeProxy(ses);
      proxyChecks[profile.proxyId] = { status: 'ok', ip, checkedAt: new Date().toISOString() };
    }
    if (cancelledStarts.has(id) || quitting) { runtime[id] = { status: 'stopped' }; return; }
    const browser = new ProfileBrowser(profile, ses, renderer, async () => {
      try { await saveSessionCookies(id, ses, true); } finally { await releaseProxy(ses); }
    }, () => { if (runtime[id]?.status === 'starting') cancelledStarts.add(id); browsers.delete(id); runtime[id] = { status: 'stopped' }; publish(); });
    browsers.set(id, browser);
    await browser.open();
    if (cancelledStarts.has(id) || browser.window.isDestroyed() || browsers.get(id) !== browser) { runtime[id] = { status: 'stopped' }; return; }
    await store.markOpened(id); runtime[id] = { status: 'running' }; publish();
  } catch (e) {
    const cancelled = cancelledStarts.has(id) || quitting;
    const browser = browsers.get(id); if (browser) await browser.close().catch(() => {});
    runtime[id] = cancelled ? { status: 'stopped' } : { status: 'error', error: (e as Error).message }; publish();
  } finally {
    if (!browsers.has(id)) { const ses = sessions.get(id); if (ses) await releaseProxy(ses); }
    cancelledStarts.delete(id); publish();
  }
}
async function stopProfiles(list: string[]): Promise<void> {
  queue.cancel(list);
  for (const id of list) {
    cancelledStarts.add(id);
    const browser = browsers.get(id);
    if (browser) { runtime[id] = { status: 'stopping' }; publish(); await browser.close(); }
    else if (runtime[id]?.status !== 'starting') runtime[id] = { status: 'stopped' };
  }
  publish();
}
function trusted(event: IpcMainInvokeEvent): void {
  if (!manager || event.sender !== manager.webContents || event.senderFrame !== manager.webContents.mainFrame) throw new Error('Доступ запрещён.');
}
function handle(method: string, fn: (...args: any[]) => unknown): void {
  ipcMain.handle(`workspace:${method}`, async (event, ...args) => { trusted(event); const result = await fn(...args); publish(); return result; });
}
function registerApi(): void {
  handle('snapshot', snapshot);
  handle('checkUpdates', () => updates?.check());
  handle('closeToUpdate', () => {
    if (updates?.snapshot().status !== 'ready') throw new Error('Обновление ещё не загружено.');
    // Normal quit saves all sessions first; updater installs on the actual quit event.
    app.quit();
  });
  handle('saveProfile', async (input: ProfileDraft) => {
    if (input.id) await locked(input.id, async () => { const ses = await readySession(input.id!); await store.saveProfile(input); await saveSessionCookies(input.id!, ses); }); else await store.saveProfile(input);
  });
  handle('deleteProfiles', async (input: unknown) => {
    const list = ids(input); list.forEach(assertStopped);
    if (list.some(id => mutations.has(id))) throw new Error('Дождитесь завершения операций с профилями.');
    const answer = await dialog.showMessageBox(manager, { type: 'warning', title: 'Удалить профили?', message: `Удалить профили: ${list.length}?`, detail: 'Будут удалены локальные cookies, сессии, теги и заметки. Это действие нельзя отменить.', buttons: ['Отмена', 'Удалить'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return;
    // Recheck after the modal dialog: launch IPC may have arrived meanwhile.
    list.forEach(assertStopped); list.forEach(id => mutations.add(id));
    try {
      for (const id of list) { const ses = profileSession(id); await ses.clearStorageData(); await ses.clearCache(); await rm(join(dataRoot, 'session-cookies', `${id}.enc`), { force: true }); }
      await store.deleteProfiles(list); list.forEach(id => { delete runtime[id]; sessions.delete(id); hydratedSessions.delete(id); });
    } finally { list.forEach(id => mutations.delete(id)); }
  });
  handle('duplicateProfile', async (id: string) => locked(id, async () => {
    const source = store.profile(id); const cookies = (await (await readySession(id)).cookies.get({})).map(portableCookie);
    const copy = await store.saveProfile({ ...source, id: undefined, name: `${source.name} — копия` });
    try { const ses = await readySession(copy.id); if (cookies.length) await replaceOrMergeCookies(ses, cookies, 'merge'); await saveSessionCookies(copy.id, ses); }
    catch (e) { await store.deleteProfiles([copy.id]); throw e; }
  }));
  handle('saveProxy', async (input: ProxyDraft) => { const list = input.id ? store.snapshot().profiles.filter(p => p.proxyId === input.id).map(p => p.id) : []; await lockedProfiles(list, async () => { await store.saveProxy(input); if (input.id) delete proxyChecks[input.id]; }); });
  handle('deleteProxy', (id: string) => store.deleteProxy(id));
  handle('checkProxy', async (id: string) => {
    if (quitting) throw new Error('Приложение закрывается.');
    store.proxy(id); if (proxyChecks[id]?.status === 'checking') throw new Error('Проверка уже выполняется.');
    proxyChecks[id] = { status: 'checking' }; publish();
    const ses = session.fromPartition(`proxy-check-${randomUUID()}`);
    try { await configureProxy(ses, id); const ip = await probeProxy(ses); proxyChecks[id] = { status: 'ok', ip, checkedAt: new Date().toISOString() }; }
    catch (e) { proxyChecks[id] = { status: 'error', error: (e as Error).message, checkedAt: new Date().toISOString() }; }
    finally { await releaseProxy(ses); }
    return proxyChecks[id];
  });
  handle('saveSettings', async (input: Settings) => { await store.saveSettings(input); queue.configure(store.snapshot().settings); });
  handle('launch', (input: unknown) => {
    if (quitting) throw new Error('Приложение закрывается.');
    const list = ids(input); if (list.some(id => mutations.has(id))) throw new Error('Дождитесь завершения операции с cookies или профилем.');
    list.forEach(id => { if (browsers.has(id)) browsers.get(id)!.window.focus(); });
    queue.enqueue(list.filter(id => !browsers.has(id)));
  });
  handle('stop', (input: unknown) => stopProfiles(ids(input)));
  handle('cancelQueue', () => queue.cancel());
  handle('bulkUpdate', async (input: unknown, patch: { tags?: string[]; proxyId?: string | null }) => { const list = ids(input); await lockedProfiles(list, () => store.bulkUpdate(list, patch)); });
  handle('cookies', async (id: string) => (await (await readySession(id)).cookies.get({})).map(portableCookie));
  handle('previewCookies', async (id: string) => {
    assertStopped(id);
    const chosen = await dialog.showOpenDialog(manager, { title: 'Импорт cookies', properties: ['openFile'], filters: [{ name: 'Cookies (JSON / Netscape)', extensions: ['json', 'txt', 'cookies'] }, { name: 'Все файлы', extensions: ['*'] }] });
    if (chosen.canceled || !chosen.filePaths[0]) return null;
    if ((await stat(chosen.filePaths[0])).size > 10 * 1024 * 1024) throw new Error('Файл cookies больше 10 МБ.');
    const parsed = parseCookies(await readFile(chosen.filePaths[0], 'utf8'));
    for (const [token, preview] of cookiePreviews) if (Date.now() - preview.createdAt > 600000) cookiePreviews.delete(token);
    const token = randomUUID(); cookiePreviews.set(token, { profileId: id, cookies: parsed.cookies, createdAt: Date.now() });
    return { token, fileName: basename(chosen.filePaths[0]), count: parsed.cookies.length, errors: parsed.errors.slice(0, 100), warnings: parsed.warnings.slice(0, 100) };
  });
  handle('importCookies', async (id: string, token: string, mode: 'merge' | 'replace') => locked(id, async () => {
    const preview = cookiePreviews.get(token);
    if (!preview || preview.profileId !== id || Date.now() - preview.createdAt > 600000) throw new Error('Предпросмотр истёк. Выберите файл ещё раз.');
    if (!preview.cookies.length) throw new Error('Нет валидных cookies. Данные не изменены.');
    if (mode === 'replace') { const answer = await dialog.showMessageBox(manager, { type: 'warning', message: 'Заменить все cookies этого профиля?', detail: 'Текущие cookies будут заменены импортируемыми.', buttons: ['Отмена', 'Заменить'], defaultId: 0, cancelId: 0 }); if (answer.response !== 1) return 0; }
    const ses = await readySession(id); const count = await replaceOrMergeCookies(ses, preview.cookies, mode);
    await saveSessionCookies(id, ses); cookiePreviews.delete(token); return count;
  }));
  handle('exportCookies', async (input: unknown, format: CookieFormat) => {
    const list = ids(input); if (!list.length) throw new Error('Выберите профили.');
    if (!['json', 'netscape'].includes(format)) throw new Error('Неверный формат.');
    const warning = await dialog.showMessageBox(manager, { type: 'warning', message: 'Экспорт содержит данные сессий', detail: `${list.length > 1 ? 'Будет создан JSON-архив cookies выбранных профилей.' : 'Храните файл в безопасном месте.'}${format === 'netscape' ? '\nNetscape не сохраняет SameSite. Для полного набора поддерживаемых атрибутов используйте JSON.' : ''}`, buttons: ['Отмена', 'Экспортировать'], defaultId: 0, cancelId: 0 });
    if (warning.response !== 1) return false;
    const chosen = await dialog.showSaveDialog(manager, { title: 'Экспорт cookies', defaultPath: list.length > 1 ? 'profiles-cookies.json' : `cookies-${list[0].slice(0, 8)}.${format === 'json' ? 'json' : 'txt'}` });
    if (chosen.canceled || !chosen.filePath) return false;
    const profiles = await Promise.all(list.map(async id => ({ name: store.profile(id).name, cookies: (await (await readySession(id)).cookies.get({})).map(portableCookie) })));
    const output = list.length > 1 ? JSON.stringify({ format: 'profile-workspace-cookies-v1', profiles }, null, 2) : serializeCookies(profiles[0].cookies, format);
    await writeFile(chosen.filePath, output, { mode: 0o600 }); return true;
  });
  handle('clearCookies', async (id: string) => locked(id, async () => {
    const answer = await dialog.showMessageBox(manager, { type: 'warning', message: 'Очистить cookies профиля?', detail: 'Сайты могут запросить повторный вход. Остальные хранилища сайтов останутся.', buttons: ['Отмена', 'Очистить'], defaultId: 0, cancelId: 0 });
    if (answer.response !== 1) return;
    const ses = await readySession(id); await ses.clearStorageData({ storages: ['cookies'] }); await ses.cookies.flushStore(); await rm(join(dataRoot, 'session-cookies', `${id}.enc`), { force: true });
  }));
  handle('revealData', () => shell.openPath(dataRoot));
  for (const method of ['state', 'navigate', 'action', 'selectTab', 'closeTab', 'sites', 'saveSite', 'deleteSite', 'openSite', 'setSitesOpen']) ipcMain.handle(`browser:${method}`, async (event, input) => {
    const browser = [...browsers.values()].find(b => b.window.webContents === event.sender);
    if (!browser || event.senderFrame !== browser.window.webContents.mainFrame) throw new Error('Доступ запрещён.');
    if (method === 'sites') return store.snapshot().sites;
    if (method === 'saveSite') return store.saveSite(input);
    if (method === 'deleteSite') return store.deleteSite(input);
    if (method === 'openSite') return browser.addTab(input);
    if (method === 'setSitesOpen') { if (typeof input !== 'boolean') throw new Error('Неверное состояние панели.'); return browser.setSitesOpen(input); }
    if (method === 'state') return browser.state();
    if (method === 'navigate') { if (typeof input !== 'string') throw new Error('Неверный адрес.'); return browser.navigate(input); }
    if (method === 'action') return browser.action(input);
    if (method === 'selectTab') return browser.selectTab(input);
    if (method === 'closeTab') return browser.closeTab(input);
  });
}
app.on('login', (event, webContents, _details, auth, callback) => {
  const c = webContents ? sessionCredentials.get(webContents.session) : undefined;
  if (auth.isProxy && c && webContents && auth.host === c.host && auth.port === c.port) {
    event.preventDefault(); const tries = loginAttempts.get(webContents.id) ?? 0; loginAttempts.set(webContents.id, tries + 1);
    if (!tries) callback(c.username, c.password); else callback();
  }
});
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => {
    if (quitting || !manager || manager.isDestroyed()) return;
    if (manager.isMinimized()) manager.restore();
    manager.focus();
  });
  app.whenReady().then(async () => {
    store = await WorkspaceStore.open(join(dataRoot, 'workspace.json'), { seal: encrypt, open: decrypt });
    if (quitting) { app.quit(); return; }
    queue.configure(store.snapshot().settings);
    autoUpdater.logger = null;
    updates = new UpdateController(autoUpdater, app.isPackaged && process.platform === 'win32' && !process.env.PORTABLE_EXECUTABLE_FILE && !process.env.PROFILE_WORKSPACE_DATA_DIR, publish);
    Menu.setApplicationMenu(null);
    registerApi();
    manager = new BrowserWindow({ title: 'Profile Workspace', width: 1440, height: 940, minWidth: 900, minHeight: 640, backgroundColor: '#121619', autoHideMenuBar: true,
      icon: join(__dirname, '../../assets/icon.png'),
      webPreferences: { preload: join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, sandbox: true, partition: 'persist:workspace-ui' } });
    manager.webContents.on('will-navigate', event => event.preventDefault());
    manager.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    manager.on('close', event => { if (!quitting) { event.preventDefault(); app.quit(); } });
    await manager.loadFile(renderer);
    updates.start();
  }).catch(e => { if (quitting) { app.exit(0); return; } dialog.showErrorBox('Не удалось запустить Profile Workspace', (e as Error).message); app.exit(1); });
  app.on('before-quit', event => {
    if (quitting) return;
    event.preventDefault(); quitting = true; queue.cancel();
    void (async () => {
      for (const id of Object.keys(runtime)) cancelledStarts.add(id);
      await Promise.all([...browsers.values()].map(b => b.close().catch(() => {})));
      await queue.idle();
      await Promise.all([...socksBridges.keys()].map(ses => releaseProxy(ses)));
      let failed = false;
      // Retry after closing tabs; also persist sessions changed without launching a browser.
      for (const [id, hydration] of hydratedSessions) {
        try { await saveSessionCookies(id, await hydration, true); } catch { failed = true; }
      }
      if (failed) {
        quitting = false;
        dialog.showErrorBox('Не удалось сохранить часть сессий', 'Приложение оставлено открытым. Cookies доступны в панели профиля. Экспортируйте важные данные или повторите закрытие после устранения ошибки сохранения.');
        return;
      }
      app.quit();
    })();
  });
  app.on('window-all-closed', () => { if (!quitting) app.quit(); });
}
