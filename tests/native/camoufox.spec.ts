import { _electron as electron, expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { socksServer } from '../helpers/socks-server';
import { readMozLz4 } from '../helpers/firefox-data';
import { DatabaseSync } from 'node:sqlite';

test('native profiles preserve identity and account storage across restarts and isolate other profiles', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-native-'));
  const fixtureTitle = `Native fixture ${basename(data)}`;
  const reports: any[] = [];
  const server = createServer((req, res) => {
    if (req.url === '/report') {
      let body = ''; req.on('data', c => body += c); req.on('end', () => { const report = JSON.parse(body); if (!reports.some(r => r.run === report.run)) reports.push(report); res.end('ok'); }); return;
    }
    res.setHeader('Content-Type', 'text/html');
    res.end(`<title>${fixtureTitle}</title><body><script>
      (async()=>{
        const prior = {cookie:document.cookie,storage:localStorage.getItem('login-fixture')};
        document.cookie='native_sid=fixture; Max-Age=3600; Path=/';
        document.cookie='session_sid=fixture; Path=/';localStorage.setItem('login-fixture','retained');
        const read=()=>({ua:navigator.userAgent,language:navigator.language,platform:navigator.platform,
          timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,screen:[screen.width,screen.height],cores:navigator.hardwareConcurrency,rtc:typeof RTCPeerConnection,dark:matchMedia('(prefers-color-scheme: dark)').matches});
        const frame=document.createElement('iframe');document.body.append(frame);
        const iframe={language:frame.contentWindow.navigator.language,timezone:new frame.contentWindow.Intl.DateTimeFormat().resolvedOptions().timeZone};
        const worker=await new Promise(resolve=>{const w=new Worker(URL.createObjectURL(new Blob(['postMessage({language:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,cores:navigator.hardwareConcurrency})'])));w.onmessage=e=>{resolve(e.data);w.terminate()}});
        await fetch('/report',{method:'POST',body:JSON.stringify({run:location.search,prior,page:read(),iframe,worker})});
      })();</script>`);
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const startUrl = `http://127.0.0.1:${(server.address() as any).port}/`;
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const launch = () => electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  let application = await launch();
  try {
    let manager = await application.firstWindow();
    await manager.evaluate(() => window.workspace.saveSite({ name: 'Shared test bookmark', url: 'https://example.org/workspace-shared' }));
    const ids = await manager.evaluate(async startUrl => {
      for (const name of ['Native A', 'Native B']) await window.workspace.saveProfile({ name, startUrl, engine: 'camoufox', nativeSettings: { locale: 'ru-RU', timezone: 'Europe/Berlin' }, restoreSessionCookies: true });
      return (await window.workspace.snapshot()).profiles.map(p => p.id);
    }, startUrl + '?run=first');
    await manager.evaluate(id => window.workspace.launch([id]), ids[0]);
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id], ids[0])).toMatchObject({ status: 'running' });
    await expect.poll(() => reports.length).toBe(1);
    expect(reports[0].page).toMatchObject({ language: 'ru-RU', timezone: 'Europe/Berlin', platform: 'Win32', rtc: 'undefined', dark: true });
    expect(reports[0].page.ua).toContain('Firefox/');
    expect(reports[0].iframe).toEqual({ language: 'ru-RU', timezone: 'Europe/Berlin' });
    expect(reports[0].worker).toMatchObject({ language: 'ru-RU', timezone: 'Europe/Berlin', cores: reports[0].page.cores });
    const identity = JSON.parse(await readFile(join(data, 'camoufox', ids[0], 'identity.json'), 'utf8'));
    expect(identity.config['navigator.userAgent']).toBe(reports[0].page.ua);
    await manager.evaluate(id => window.workspace.stop([id]), ids[0]);
    const sealed = await readFile(join(data, 'camoufox-sessions', `${ids[0]}.enc`), 'utf8');
    const savedNames = await application.evaluate(async ({ safeStorage }, raw) => JSON.parse((await safeStorage.decryptStringAsync(Buffer.from(raw, 'base64'))).result).cookies.map((c: any) => c.name), sealed);
    expect(savedNames).toContain('session_sid');
    const checkBrowserDefaults = async (id: string) => {
      const db = new DatabaseSync(join(data, 'camoufox', id, 'browser', 'places.sqlite'), { readOnly: true });
      try { expect(db.prepare('SELECT count(*) AS count FROM moz_bookmarks b JOIN moz_places p ON b.fk=p.id WHERE p.url=?').get('https://example.org/workspace-shared')).toMatchObject({ count: 1 }); } finally { db.close(); }
      const search = readMozLz4(await readFile(join(data, 'camoufox', id, 'browser', 'search.json.mozlz4')));
      expect(search.metaData.current || search.metaData.defaultEngineId || search.metaData.appDefaultEngineId).toMatch(/duckduckgo|ddg/i);
    };
    await checkBrowserDefaults(ids[0]);
    const cookies = await manager.evaluate(id => window.workspace.cookies(id), ids[0]);
    expect(cookies.map(c => c.name)).toEqual(expect.arrayContaining(['native_sid', 'session_sid']));
    await application.evaluate(({ safeStorage }) => {
      const state = globalThis as any; state.originalNativeEncrypt = safeStorage.encryptStringAsync;
      state.nativeSaveHeld = new Promise<void>(resolve => { state.releaseNativeSave = resolve; }); state.nativeSaveEntered = false;
      safeStorage.encryptStringAsync = async value => { state.nativeSaveEntered = true; await state.nativeSaveHeld; return state.originalNativeEncrypt.call(safeStorage, value); };
    });
    const pendingRead = manager.evaluate(id => window.workspace.cookies(id), ids[0]);
    try {
      await expect.poll(() => application.evaluate(() => (globalThis as any).nativeSaveEntered)).toBe(true);
      await expect(manager.evaluate(async id => { const p = (await window.workspace.snapshot()).profiles.find(p => p.id === id)!; await window.workspace.saveProfile({ ...p, name: 'Must wait for save' }); }, ids[0])).rejects.toThrow('сохранения');
      await expect(manager.evaluate(id => window.workspace.deleteProfiles([id]), ids[0])).rejects.toThrow('сохранения');
    } finally { await application.evaluate(({ safeStorage }) => { const state = globalThis as any; safeStorage.encryptStringAsync = state.originalNativeEncrypt; state.releaseNativeSave(); }); }
    await pendingRead;
    await application.close(); application = await launch(); manager = await application.firstWindow();
    await manager.evaluate(async ({id, url}) => { const p = (await window.workspace.snapshot()).profiles.find(p => p.id === id)!; await window.workspace.saveProfile({ ...p, startUrl: url }); await window.workspace.launch([id]); }, {id:ids[0],url:startUrl+'?run=restart'});
    await expect.poll(() => reports.length).toBe(2);
    expect(reports[1].prior).toMatchObject({ storage: 'retained' });
    expect(reports[1].prior.cookie).toContain('native_sid=fixture');
    expect(reports[1].prior.cookie).toContain('session_sid=fixture');
    expect(reports[1].page).toEqual(reports[0].page);
    await manager.evaluate(id => window.workspace.stop([id]), ids[0]);
    await manager.evaluate(async id => { const p = (await window.workspace.snapshot()).profiles.find(p => p.id === id)!; await window.workspace.saveProfile({ ...p, restoreSessionCookies: false, startUrl: p.startUrl.replace('restart', 'no-restore') }); await window.workspace.launch([id]); }, ids[0]);
    await expect.poll(() => reports.length).toBe(3);
    expect(reports[2].prior.cookie).not.toContain('session_sid');
    await manager.evaluate(id => window.workspace.stop([id]), ids[0]);
    const importedFile = join(data, 'import.json');
    await writeFile(importedFile, JSON.stringify([{ domain: '127.0.0.1', name: 'imported_sid', value: 'synthetic', path: '/' }]));
    await application.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, importedFile);
    await manager.evaluate(async id => { const preview = await window.workspace.previewCookies(id); await window.workspace.importCookies(id, preview!.token, 'merge'); }, ids[0]);
    expect((await manager.evaluate(id => window.workspace.cookies(id), ids[0])).map(c => c.name)).toContain('imported_sid');
    await manager.evaluate(async id => { const p = (await window.workspace.snapshot()).profiles.find(p => p.id === id)!; await window.workspace.saveProfile({ ...p, startUrl: p.startUrl.replace('no-restore','import') }); await window.workspace.launch([id]); }, ids[0]);
    await expect.poll(() => reports.length).toBe(4);
    expect(reports[3].prior.cookie).toContain('imported_sid=synthetic');
    await manager.evaluate(id => window.workspace.stop([id]), ids[0]);
    await manager.evaluate(async id => { const p = (await window.workspace.snapshot()).profiles.find(p => p.id === id)!; await window.workspace.saveProfile({ ...p, startUrl: p.startUrl.replace('first','isolated') }); await window.workspace.launch([id]); }, ids[1]);
    await expect.poll(() => reports.length).toBe(5);
    expect(reports[4].prior).toEqual({ cookie: '', storage: null });
    await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      "Get-Process -Name camoufox | Where-Object { $_.MainWindowTitle.Contains($env:WORKSPACE_NATIVE_FIXTURE) } | ForEach-Object { [void]$_.CloseMainWindow() }"],
      { windowsHide: true, env: { ...process.env, WORKSPACE_NATIVE_FIXTURE: fixtureTitle } });
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, ids[1])).toBe('stopped');
    expect((await manager.evaluate(id => window.workspace.cookies(id), ids[1])).map(c => c.name)).toContain('session_sid');
    await checkBrowserDefaults(ids[1]);
    await manager.evaluate(async () => {
      await window.workspace.saveProxy({ name: 'Unreachable', protocol: 'http', host: '127.0.0.1', port: 1 });
      const p = (await window.workspace.snapshot()).profiles[0], proxy = (await window.workspace.snapshot()).proxies[0];
      await window.workspace.saveProfile({ ...p, proxyId: proxy.id }); await window.workspace.launch([p.id]);
    });
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, ids[0])).toBe('error');
    expect(reports).toHaveLength(5);
  } finally {
    await application.close(); await new Promise<void>(r => server.close(() => r())); await rm(data, { recursive: true, force: true });
  }
});

test('native Firefox reaches a site through authenticated SOCKS5 with remote DNS', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-native-proxy-'));
  const socks = await socksServer(); let hits = 0;
  const server = createServer((_req, res) => { hits++; res.end('<title>Native proxy fixture</title><body>Through SOCKS</body>'); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const manager = await app.firstWindow();
    const id = await manager.evaluate(async ({ proxyPort, port }) => {
      await window.workspace.saveProxy({ name: 'Native SOCKS', protocol: 'socks5', host: '127.0.0.1', port: proxyPort, username: 'service-user', password: 'service:p@ss/%' });
      const proxy = (await window.workspace.snapshot()).proxies[0];
      await window.workspace.saveProfile({ name: 'Native proxied', engine: 'camoufox', proxyId: proxy.id, startUrl: `http://profile-target.invalid:${port}/` });
      const id = (await window.workspace.snapshot()).profiles[0].id; await window.workspace.launch([id]); return id;
    }, { proxyPort: socks.port, port: (server.address() as any).port });
    await expect.poll(() => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id], id)).toMatchObject({ status: 'running' });
    await expect.poll(() => hits).toBeGreaterThan(0);
    expect(socks.destinations.some(d => d.host === 'profile-target.invalid')).toBe(true);
    await manager.evaluate(id => window.workspace.stop([id]), id);
    const identity = await readFile(join(data, 'camoufox', id, 'identity.json'), 'utf8');
    expect(identity).not.toContain('service:p@ss/%');
  } finally { await app.close(); await socks.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(data, { recursive: true, force: true }); }
});

test('simultaneous native launches apply changed shared bookmarks without a policy write race', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-native-parallel-'));
  const server = createServer((_req, res) => res.end('<title>Parallel native fixture</title><body>Ready</body>'));
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const manager = await app.firstWindow();
    await manager.evaluate(async port => {
      await window.workspace.saveSite({ name: 'Parallel bookmark', url: 'https://example.org/parallel-policy-check' });
      for (const name of ['Parallel A', 'Parallel B']) await window.workspace.saveProfile({ name, engine: 'camoufox', startUrl: `http://127.0.0.1:${port}/` });
      await window.workspace.launch((await window.workspace.snapshot()).profiles.map(p => p.id));
    }, (server.address() as any).port);
    await expect.poll(() => manager.evaluate(async () => { const s = await window.workspace.snapshot(); return s.profiles.map(p => s.runtime[p.id]?.status); }), { timeout: 45000 }).toEqual(['running', 'running']);
    await manager.evaluate(async () => window.workspace.stop((await window.workspace.snapshot()).profiles.map(p => p.id)));
  } finally { await app.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(data, { recursive: true, force: true }); }
});
