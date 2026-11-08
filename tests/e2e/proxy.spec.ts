import { _electron as electron, test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { connect } from 'node:net';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
  const application = await electron.launch({ args: ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
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
