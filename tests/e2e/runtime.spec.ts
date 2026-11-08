import { _electron as electron, test, expect, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { createSocket } from 'node:dgram';
let application: ElectronApplication; let directory: string; let server: Server; let origin: string;
test.beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'profile-e2e-'));
  server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); if (req.url !== '/blank') res.setHeader('Set-Cookie', ['httponly=secret; HttpOnly; Path=/; Max-Age=3600', 'session_only=hello; Path=/']); res.end('<title>Session test</title><h1>Local session test</h1>' + (req.url === '/blank' ? '' : '<script>document.cookie="persistent=one; Max-Age=3600; Path=/";localStorage.setItem("saved","yes")</script>')); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
  application = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: directory } });
});
test.afterAll(async () => { await application?.close(); await new Promise<void>(r => server?.close(() => r())); await rm(directory, { recursive: true, force: true }); });

test('isolates profiles and preserves cookies and Local Storage across browser restarts', async () => {
  const manager = await application.firstWindow();
  await manager.evaluate(async (url) => {
    await window.workspace.saveProfile({ name: 'Alpha', startUrl: url, restoreSessionCookies: true });
    await window.workspace.saveProfile({ name: 'Beta', startUrl: url });
    const s = await window.workspace.snapshot(); await window.workspace.launch([s.profiles[0].id]);
  }, origin);
  await expect.poll(async () => manager.evaluate(async () => (await window.workspace.snapshot()).runtime[(await window.workspace.snapshot()).profiles[0].id]?.status)).toBe('running');
  await expect.poll(async () => manager.evaluate(async () => (await window.workspace.cookies((await window.workspace.snapshot()).profiles[0].id)).some(c => c.name === 'persistent'))).toBe(true);
  expect(await manager.evaluate(async () => window.workspace.cookies((await window.workspace.snapshot()).profiles[1].id))).toEqual([]);
  const ids = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles.map(p => p.id));
  const stored = await application.evaluate(async ({ session }, id) => {
    const s = session.fromPartition(`persist:profile-${id}`); return s.cookies.get({});
  }, ids[0]);
  expect(stored.find(c => c.name === 'persistent')?.value).toBe('one');
  const privileges = await application.evaluate(async ({ webContents }, url) => {
    const content = webContents.getAllWebContents().find(w => w.getURL().startsWith(url));
    return content?.executeJavaScript('JSON.stringify([typeof window.workspace, typeof window.require])');
  }, origin);
  expect(privileges).toBe('["undefined","undefined"]');
  await manager.evaluate(id => window.workspace.stop([id]), ids[0]);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status ?? 'stopped', ids[0])).toBe('stopped');
  await manager.evaluate(id => window.workspace.launch([id]), ids[0]);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, ids[0])).toBe('running');
  const value = await application.evaluate(async ({ webContents }, url) => {
    const contents = webContents.getAllWebContents().find(w => w.getURL().startsWith(url));
    return contents?.executeJavaScript('localStorage.getItem("saved")');
  }, origin);
  expect(value).toBe('yes');
  await manager.evaluate(id => window.workspace.stop([id]), ids[0]);
});

test('imports session cookies without immediately deleting them and rolls back rejected replacements', async () => {
  const manager = await application.firstWindow();
  await manager.evaluate(async () => window.workspace.saveProfile({ name: 'Import target', restoreSessionCookies: false }));
  const id = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Import target')!.id);
  const file = join(directory, 'import.json');
  await writeFile(file, JSON.stringify([{ domain: 'example.com', name: 'session', value: 'imported-value', httpOnly: true }]));
  await application.evaluate(({ dialog }, path) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] }); dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false }); }, file);
  const preview = await manager.evaluate(id => window.workspace.previewCookies(id), id);
  expect(preview?.count).toBe(1);
  await manager.evaluate(async ({ id, token }) => window.workspace.importCookies(id, token, 'merge'), { id, token: preview!.token });
  expect(await manager.evaluate(id => window.workspace.cookies(id), id)).toMatchObject([{ name: 'session', value: 'imported-value', httpOnly: true }]);
  await writeFile(file, JSON.stringify([{ domain: 'example.com', name: '__Host-invalid', value: 'bad', secure: true, path: '/wrong' }]));
  const bad = await manager.evaluate(id => window.workspace.previewCookies(id), id);
  await expect(manager.evaluate(async ({ id, token }) => window.workspace.importCookies(id, token, 'replace'), { id, token: bad!.token })).rejects.toThrow();
  expect(await manager.evaluate(id => window.workspace.cookies(id), id)).toMatchObject([{ name: 'session', value: 'imported-value' }]);
});

test('stopping a profile during navigation does not later mark a closed browser as running', async () => {
  const manager = await application.firstWindow();
  await manager.evaluate(async () => window.workspace.saveProfile({ name: 'Cancel start', startUrl: 'http://192.0.2.1/' }));
  const id = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Cancel start')!.id);
  await manager.evaluate(id => window.workspace.launch([id]), id);
  await expect.poll(async () => application.evaluate(({ BrowserWindow }, count) => BrowserWindow.getAllWindows().length > count, 1)).toBe(true);
  await manager.evaluate(id => window.workspace.stop([id]), id);
  await expect.poll(async () => manager.evaluate(async id => { const s = await window.workspace.snapshot(); return s.queue.active === 0 ? s.runtime[id]?.status : 'waiting'; }, id)).toBe('stopped');
});

test('a dead assigned proxy fails closed and remote pages have no privileged bridge', async () => {
  const manager = await application.firstWindow();
  await manager.evaluate(async url => {
    await window.workspace.saveProxy({ name: 'Offline', protocol: 'http', host: '127.0.0.1', port: 1 });
    const proxy = (await window.workspace.snapshot()).proxies[0];
    await window.workspace.saveProfile({ name: 'Proxy blocked', proxyId: proxy.id, startUrl: url });
    const p = (await window.workspace.snapshot()).profiles.find(p => p.name === 'Proxy blocked')!;
    await window.workspace.launch([p.id]);
  }, origin);
  await expect.poll(async () => manager.evaluate(async () => { const s = await window.workspace.snapshot(); return s.runtime[s.profiles.find(p => p.name === 'Proxy blocked')!.id]?.status; })).toBe('error');
  expect(await application.evaluate(({ webContents }) => webContents.getAllWebContents().filter(w => w.getURL().startsWith('http:')).length)).toBe(0);
});

test('restores disk-backed profiles, HttpOnly cookies and opted-in session cookies after application restart', async () => {
  let manager = await application.firstWindow();
  const profile = await manager.evaluate(async url => {
    const p = (await window.workspace.snapshot()).profiles.find(p => p.name === 'Alpha')!;
    await window.workspace.saveProfile({ ...p, startUrl: `${url}blank` }); return p;
  }, origin);
  const duplicateId = await manager.evaluate(async id => { await window.workspace.duplicateProfile(id); return (await window.workspace.snapshot()).profiles.find(p => p.name === 'Alpha — копия')!.id; }, profile.id);
  await application.close();
  application = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: directory } });
  manager = await application.firstWindow();
  const persistent = await manager.evaluate(id => window.workspace.cookies(id), profile.id);
  expect(persistent.find(c => c.name === 'persistent')?.value).toBe('one');
  expect(persistent.find(c => c.name === 'httponly')).toMatchObject({ value: 'secret', httpOnly: true });
  await manager.evaluate(id => window.workspace.launch([id]), profile.id);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, profile.id)).toBe('running');
  expect((await manager.evaluate(id => window.workspace.cookies(id), profile.id)).find(c => c.name === 'session_only')?.value).toBe('hello');
  expect(await application.evaluate(async ({ webContents }, url) => webContents.getAllWebContents().find(w => w.getURL().startsWith(url))?.executeJavaScript('localStorage.getItem("saved")'), origin)).toBe('yes');
  await manager.evaluate(id => window.workspace.stop([id]), profile.id);
  await manager.evaluate(id => window.workspace.launch([id]), duplicateId);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, duplicateId)).toBe('running');
  expect((await manager.evaluate(id => window.workspace.cookies(id), duplicateId)).find(c => c.name === 'session_only')?.value).toBe('hello');
  await manager.evaluate(id => window.workspace.stop([id]), duplicateId);
  expect((await readFile(join(directory, 'workspace.json'), 'utf8'))).not.toContain('imported-value');
});

test('WebRTC does not send UDP outside an assigned failed proxy', async () => {
  const udp = createSocket('udp4'); let packets = 0; udp.on('message', () => packets++);
  await new Promise<void>(r => udp.bind(0, '127.0.0.1', r));
  const manager = await application.firstWindow();
  const id = await manager.evaluate(async url => { await window.workspace.saveProfile({ name: 'RTC isolation', startUrl: url }); const p = (await window.workspace.snapshot()).profiles.find(p => p.name === 'RTC isolation')!; await window.workspace.launch([p.id]); return p.id; }, origin);
  try {
    await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
    await application.evaluate(async ({ webContents }, { url, port }) => {
      const w = webContents.getAllWebContents().find(w => w.getURL() === url)!;
      await w.session.setProxy({ mode: 'fixed_servers', proxyRules: 'http://127.0.0.1:1', proxyBypassRules: '<-loopback>' });
      await w.executeJavaScript(`(async()=>{window.reviewPeer=new RTCPeerConnection({iceServers:[{urls:'stun:127.0.0.1:${port}'}]});reviewPeer.createDataChannel('x');await reviewPeer.setLocalDescription(await reviewPeer.createOffer())})()`);
    }, { url: origin, port: (udp.address() as { port: number }).port });
    await new Promise(r => setTimeout(r, 1800));
    expect(packets).toBe(0);
  } finally { udp.close(); await manager.evaluate(id => window.workspace.stop([id]), id); }
});

test('hydrates saved session cookies before stopped reads and merge imports after restart', async () => {
  let manager = await application.firstWindow();
  await manager.evaluate(async () => window.workspace.saveProfile({ name: 'Saved import', restoreSessionCookies: true }));
  const id = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Saved import')!.id);
  const file = join(directory, 'hydrate.json');
  await writeFile(file, JSON.stringify([{ domain: 'example.com', name: 'original_sid', value: 'keep-me' }]));
  await application.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
  const p = await manager.evaluate(id => window.workspace.previewCookies(id), id);
  await manager.evaluate(({ id, token }) => window.workspace.importCookies(id, token, 'merge'), { id, token: p!.token });
  await application.close();
  application = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: directory } });
  manager = await application.firstWindow();
  expect((await manager.evaluate(id => window.workspace.cookies(id), id)).map(c => c.name)).toEqual(['original_sid']);
  await writeFile(file, JSON.stringify([{ domain: 'example.com', name: 'new_cookie', value: 'additional' }]));
  await application.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, file);
  const next = await manager.evaluate(id => window.workspace.previewCookies(id), id);
  await manager.evaluate(({ id, token }) => window.workspace.importCookies(id, token, 'merge'), { id, token: next!.token });
  expect((await manager.evaluate(id => window.workspace.cookies(id), id)).map(c => c.name).sort()).toEqual(['new_cookie', 'original_sid']);
});

test('session encryption failure during stop is reported while cookies remain recoverable', async () => {
  const manager = await application.firstWindow();
  const id = await manager.evaluate(async url => { await window.workspace.saveProfile({ name: 'Save failure', startUrl: url, restoreSessionCookies: true }); const id = (await window.workspace.snapshot()).profiles.find(p => p.name === 'Save failure')!.id; await window.workspace.launch([id]); return id; }, origin);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
  await application.evaluate(({ safeStorage }) => { (globalThis as any).originalEncrypt = safeStorage.encryptStringAsync; safeStorage.encryptStringAsync = async () => { throw new Error('Simulated encryption failure'); }; });
  try {
    await expect(manager.evaluate(id => window.workspace.stop([id]), id)).rejects.toThrow('Simulated encryption failure');
    expect((await manager.evaluate(id => window.workspace.cookies(id), id)).some(c => c.name === 'session_only')).toBe(true);
  } finally { await application.evaluate(({ safeStorage }) => { safeStorage.encryptStringAsync = (globalThis as any).originalEncrypt; }); }
});

test('native browser close reports session-save failure instead of losing it in a rejected promise', async () => {
  const manager = await application.firstWindow();
  const id = await manager.evaluate(async url => { await window.workspace.saveProfile({ name: 'Native close', startUrl: url, restoreSessionCookies: true }); const id = (await window.workspace.snapshot()).profiles.find(p => p.name === 'Native close')!.id; await window.workspace.launch([id]); return id; }, origin);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
  await application.evaluate(({ safeStorage, dialog, BrowserWindow }) => {
    (globalThis as any).originalEncrypt = safeStorage.encryptStringAsync; (globalThis as any).originalErrorBox = dialog.showErrorBox;
    (globalThis as any).saveErrorShown = false;
    safeStorage.encryptStringAsync = async () => { throw new Error('Simulated encryption failure'); };
    dialog.showErrorBox = () => { (globalThis as any).saveErrorShown = true; };
    BrowserWindow.getAllWindows().find(w => w.webContents.getURL().includes('mode=browser'))!.close();
  });
  try { await expect.poll(async () => application.evaluate(() => (globalThis as any).saveErrorShown)).toBe(true); }
  finally { await application.evaluate(({ safeStorage, dialog }) => { safeStorage.encryptStringAsync = (globalThis as any).originalEncrypt; dialog.showErrorBox = (globalThis as any).originalErrorBox; }); }
});

test('application quit stays open for recovery if session encryption fails', async () => {
  const manager = await application.firstWindow();
  const id = await manager.evaluate(async url => { await window.workspace.saveProfile({ name: 'Quit failure', startUrl: url, restoreSessionCookies: true }); const id = (await window.workspace.snapshot()).profiles.find(p => p.name === 'Quit failure')!.id; await window.workspace.launch([id]); return id; }, origin);
  await expect.poll(async () => manager.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, id)).toBe('running');
  await application.evaluate(({ app, safeStorage, dialog }) => {
    (globalThis as any).originalEncrypt = safeStorage.encryptStringAsync; (globalThis as any).originalErrorBox = dialog.showErrorBox; (globalThis as any).saveErrorShown = false;
    safeStorage.encryptStringAsync = async () => { throw new Error('Simulated encryption failure'); };
    dialog.showErrorBox = () => { (globalThis as any).saveErrorShown = true; };
    app.quit();
  });
  try {
    await expect.poll(async () => application.evaluate(() => (globalThis as any).saveErrorShown)).toBe(true);
    expect((await manager.evaluate(id => window.workspace.cookies(id), id)).some(c => c.name === 'session_only')).toBe(true);
  } finally { await application.evaluate(({ safeStorage, dialog }) => { safeStorage.encryptStringAsync = (globalThis as any).originalEncrypt; dialog.showErrorBox = (globalThis as any).originalErrorBox; }).catch(() => {}); }
});

test('failed snapshot hydration never overwrites or deletes the saved encrypted file on quit', async () => {
  let manager = await application.firstWindow();
  await manager.evaluate(() => window.workspace.saveProfile({ name: 'Unreadable snapshot', restoreSessionCookies: true }));
  const id = await manager.evaluate(async () => (await window.workspace.snapshot()).profiles.find(p => p.name === 'Unreadable snapshot')!.id);
  const original = await application.evaluate(async ({ safeStorage }) => { await safeStorage.isAsyncEncryptionAvailable(); return (await safeStorage.encryptStringAsync('[{"domain":"example.com","name":"saved","value":"keep"}]')).toString('base64'); });
  await application.close();
  await mkdir(join(directory, 'session-cookies'), { recursive: true });
  const file = join(directory, 'session-cookies', `${id}.enc`);
  await writeFile(file, original);
  application = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: directory } });
  manager = await application.firstWindow();
  await application.evaluate(({ safeStorage }) => { (globalThis as any).originalDecrypt = safeStorage.decryptStringAsync; safeStorage.decryptStringAsync = async () => { throw new Error('Simulated temporary decryption failure'); }; });
  await expect(manager.evaluate(id => window.workspace.cookies(id), id)).rejects.toThrow();
  await application.evaluate(({ safeStorage }) => { safeStorage.decryptStringAsync = (globalThis as any).originalDecrypt; });
  await application.close();
  expect(await readFile(file, 'utf8')).toBe(original);
  application = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: directory } });
  await application.firstWindow();
  await (await application.firstWindow()).waitForFunction(() => Boolean(window.workspace));
});
