import { _electron as electron, test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { socksServer } from '../helpers/socks-server';

async function launchWorkspace(data: string) {
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const application = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  if (executablePath) expect(await application.evaluate(({ app }) => ({ packaged: app.isPackaged, version: app.getVersion() }))).toEqual({ packaged: true, version: process.env.PROFILE_WORKSPACE_TEST_VERSION ?? '0.1.2' });
  return application;
}

test('authenticated SOCKS5 checks IP, routes a real browser with remote DNS, closes on stop and restarts', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-socks-'));
  const socks = await socksServer();
  let hits = 0;
  const target = createServer((_req, res) => { hits++; res.end('<title>Via SOCKS</title><h1>Proxy target</h1>'); });
  await new Promise<void>(r => target.listen(0, '127.0.0.1', r));
  const targetPort = (target.address() as { port: number }).port;
  const application = await launchWorkspace(data);
  try {
    const page = await application.firstWindow();
    await page.getByRole('button', { name: 'Прокси', exact: false }).first().click();
    await page.getByRole('button', { name: 'Новый прокси', exact: true }).click();
    await page.getByLabel('Название прокси').fill('Nord test');
    await page.getByLabel('Протокол').selectOption('socks5');
    await page.getByLabel('Сервер', { exact: true }).fill('127.0.0.1');
    await page.getByLabel('Порт', { exact: true }).fill(String(socks.port));
    await page.getByLabel('Логин', { exact: true }).fill('service-user');
    await page.getByLabel('Пароль', { exact: true }).fill('service:p@ss/%');
    await page.getByRole('button', { name: 'Сохранить прокси', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Nord test', exact: true })).toBeVisible();
    const id = await page.evaluate(async targetPort => {
      const p = (await window.workspace.snapshot()).proxies[0];
      const check = await window.workspace.checkProxy(p.id);
      if (check.status !== 'ok') throw new Error(JSON.stringify(check));
      await window.workspace.saveProfile({ name: 'Socks browser', proxyId: p.id, startUrl: `http://profile-target.invalid:${targetPort}/` });
      return (await window.workspace.snapshot()).profiles[0].id;
    }, targetPort);
    const launch = async () => {
      await page.evaluate(id => window.workspace.launch([id]), id);
      await expect.poll(() => page.evaluate(async id => (await window.workspace.snapshot()).runtime[id], id)).toMatchObject({ status: 'running' });
      await expect.poll(() => hits).toBeGreaterThan(0);
    };
    await launch();
    const rules = await application.evaluate(({ session }, id) => session.fromPartition(`persist:profile-${id}`).resolveProxy('https://example.com'), id);
    expect(rules).toMatch(/^PROXY 127\.0\.0\.1:\d+$/);
    const bridgePort = Number(rules.split(':').at(-1));
    await page.evaluate(id => window.workspace.stop([id]), id);
    await expect(new Promise<void>((resolve, reject) => {
      const c = connect(bridgePort, '127.0.0.1'); c.on('connect', () => { c.destroy(); reject(new Error('bridge still listening')); }); c.on('error', () => resolve());
    })).resolves.toBeUndefined();
    const previousHits = hits; await launch();
    await expect.poll(() => hits).toBeGreaterThan(previousHits);
    expect(socks.destinations.some(d => d.host === 'profile-target.invalid')).toBe(true);
    expect(socks.destinations.some(d => d.host === 'api.ipify.org')).toBe(true);
    expect(await readFile(join(data, 'workspace.json'), 'utf8')).not.toContain('service:p@ss/%');
    expect(await page.evaluate(async () => JSON.stringify(await window.workspace.snapshot()))).not.toContain('service:p@ss/%');
  } finally {
    await application.close(); await socks.close(); target.closeAllConnections();
    await new Promise<void>(r => target.close(() => r())); await rm(data, { recursive: true, force: true });
  }
});

test('wrong SOCKS5 credentials fail the check and prevent profile launch without direct fallback', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-socks-reject-'));
  const socks = await socksServer();
  let hits = 0;
  const target = createServer((_req, res) => { hits++; res.end('must not load'); });
  await new Promise<void>(r => target.listen(0, '127.0.0.1', r));
  const application = await launchWorkspace(data);
  try {
    const page = await application.firstWindow();
    const result = await page.evaluate(async ({ port, targetPort }) => {
      await window.workspace.saveProxy({ name: 'Wrong password', protocol: 'socks5', host: '127.0.0.1', port, username: 'service-user', password: 'wrong-secret' });
      const proxy = (await window.workspace.snapshot()).proxies[0];
      const check = await window.workspace.checkProxy(proxy.id);
      await window.workspace.saveProfile({ name: 'Must fail', proxyId: proxy.id, startUrl: `http://127.0.0.1:${targetPort}/` });
      const id = (await window.workspace.snapshot()).profiles[0].id;
      await window.workspace.launch([id]); return { check, id };
    }, { port: socks.port, targetPort: (target.address() as { port: number }).port });
    expect(result.check.status).toBe('error');
    await expect.poll(() => page.evaluate(async id => (await window.workspace.snapshot()).runtime[id]?.status, result.id)).toBe('error');
    expect(hits).toBe(0); expect(socks.destinations).toHaveLength(0);
    expect(socks.authentications.length).toBeGreaterThan(0);
    expect(result.check.error).not.toContain('wrong-secret');
  } finally {
    await application.close(); await socks.close(); target.closeAllConnections();
    await new Promise<void>(r => target.close(() => r())); await rm(data, { recursive: true, force: true });
  }
});

test('HTTP proxy authentication reaches IP check through a local CONNECT proxy without storing plaintext password', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-proxy-'));
  let authorizedTunnels = 0;
  const proxy = createServer();
  proxy.on('connect', (request, client, head) => {
    if (request.headers['proxy-authorization'] !== `Basic ${Buffer.from('test-user:local-test-password').toString('base64')}`) {
      client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="Local test"\r\nContent-Length: 0\r\n\r\n'); return;
    }
    authorizedTunnels++;
    const [host, port] = request.url!.split(':');
    const upstream = connect(Number(port), host, () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); if (head.length) upstream.write(head); client.pipe(upstream); upstream.pipe(client); });
    upstream.on('error', () => client.destroy()); client.on('error', () => upstream.destroy()); client.on('close', () => upstream.destroy());
  });
  await new Promise<void>(r => proxy.listen(0, '127.0.0.1', r));
  const application = await launchWorkspace(data);
  try {
    const page = await application.firstWindow();
    const result = await page.evaluate(async port => {
      await window.workspace.saveProxy({ name: 'Authenticated local proxy', protocol: 'http', host: '127.0.0.1', port, username: 'test-user', password: 'local-test-password' });
      const proxy = (await window.workspace.snapshot()).proxies[0];
      return window.workspace.checkProxy(proxy.id);
    }, (proxy.address() as { port: number }).port);
    expect(result.status, JSON.stringify(result)).toBe('ok');
    expect(result.ip).toMatch(/^[\da-f:.]+$/i);
    expect(authorizedTunnels).toBeGreaterThan(0);
    expect(await readFile(join(data, 'workspace.json'), 'utf8')).not.toContain('local-test-password');
  } finally {
    await application.close(); await new Promise<void>(r => proxy.close(() => r())); await rm(data, { recursive: true, force: true });
  }
});
