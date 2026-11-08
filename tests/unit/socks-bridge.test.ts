import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { afterEach, expect, it } from 'vitest';
import { startSocksBridge } from '../../electron/socks-bridge';
import { socksServer } from '../helpers/socks-server';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });
async function setup(reject = false) {
  const upstream = await socksServer(undefined, undefined, reject); cleanup.push(upstream.close);
  let hits = 0;
  const origin = createServer((_req, res) => { hits++; res.end('through-socks'); });
  await new Promise<void>(r => origin.listen(0, '127.0.0.1', r));
  cleanup.push(async () => { origin.closeAllConnections(); await new Promise<void>(r => origin.close(() => r())); });
  const bridge = await startSocksBridge({ host: '127.0.0.1', port: upstream.port }, { username: 'service-user', password: 'service:p@ss/%' });
  cleanup.push(bridge.close);
  const port = (origin.address() as { port: number }).port;
  const auth = `Basic ${Buffer.from(`${bridge.credentials.username}:${bridge.credentials.password}`).toString('base64')}`;
  return { upstream, bridge, target: `http://remote.invalid:${port}/`, port, auth, hits: () => hits };
}
function get(proxy: { host: string; port: number }, target: string, auth?: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = request({ hostname: proxy.host, port: proxy.port, path: target, headers: auth ? { 'Proxy-Authorization': auth } : {} }, res => {
      let body = ''; res.on('data', c => body += c); res.on('end', () => resolve({ status: res.statusCode!, body }));
    });
    req.on('error', reject); req.end();
  });
}
it('authenticates locally, forwards HTTP through SOCKS5 with remote DNS and escaped credentials, and closes its port', async () => {
  const { bridge, target, auth, upstream, hits } = await setup();
  expect((await get(bridge.credentials, target)).status).toBe(407);
  expect(upstream.authentications).toHaveLength(0);
  expect(await get(bridge.credentials, target, auth)).toEqual({ status: 200, body: 'through-socks' });
  expect(upstream.authentications).toContainEqual({ username: 'service-user', password: 'service:p@ss/%' });
  expect(upstream.destinations[0].host).toBe('remote.invalid'); expect(hits()).toBe(1);
  await bridge.close(); await bridge.close();
  await expect(get(bridge.credentials, target, auth)).rejects.toThrow();
});
it('tunnels CONNECT through authenticated SOCKS5', async () => {
  const { bridge, port, auth, upstream } = await setup();
  const body = await new Promise<string>((resolve, reject) => {
    const client = connect(bridge.credentials.port, bridge.credentials.host, () => {
      client.write(`CONNECT remote.invalid:${port} HTTP/1.1\r\nHost: remote.invalid:${port}\r\nProxy-Authorization: ${auth}\r\n\r\n`);
    });
    let data = ''; let tunneled = false;
    client.on('data', chunk => {
      data += chunk;
      if (!tunneled && data.includes('\r\n\r\n')) {
        if (!data.startsWith('HTTP/1.1 200')) { client.destroy(); reject(new Error(data)); return; }
        tunneled = true; client.write('GET / HTTP/1.1\r\nHost: remote.invalid\r\nConnection: close\r\n\r\n');
      }
    });
    client.on('end', () => resolve(data)); client.on('error', reject);
  });
  expect(body).toContain('through-socks'); expect(upstream.destinations[0].host).toBe('remote.invalid');
});
it('fails closed when upstream authentication is rejected, without leaking credentials in the response', async () => {
  const { bridge, target, auth, hits } = await setup(true);
  const result = await get(bridge.credentials, target, auth);
  expect(result.status).toBeGreaterThanOrEqual(500); expect(hits()).toBe(0);
  expect(result.body).not.toContain('service:p@ss/%');
});
