import { randomUUID } from 'node:crypto';
import { Server } from 'proxy-chain';

export interface ProxyCredentials { host: string; port: number; username: string; password: string }
export interface SocksBridge {
  proxyRules: string;
  credentials: ProxyCredentials;
  close(): Promise<void>;
}

/** Chromium authenticates to this private HTTP endpoint; SOCKS auth stays in Node. */
export async function startSocksBridge(
  proxy: { host: string; port: number }, auth: { username: string; password: string },
): Promise<SocksBridge> {
  const upstream = new URL(`socks5h://${proxy.host}:${proxy.port}`);
  upstream.username = encodeURIComponent(auth.username); upstream.password = encodeURIComponent(auth.password);
  const username = randomUUID(); const password = randomUUID();
  const server = new Server({
    host: '127.0.0.1', port: 0, verbose: false,
    prepareRequestFunction: input => ({
      requestAuthentication: input.username !== username || input.password !== password,
      upstreamProxyUrl: upstream.href,
      failMsg: 'Local proxy authentication required.',
    }),
  });
  // Do not log library errors: an upstream URL can contain service credentials.
  server.on('requestFailed', () => {});
  await server.listen();
  let closing: Promise<void> | undefined;
  return {
    proxyRules: `http://127.0.0.1:${server.port}`,
    credentials: { host: '127.0.0.1', port: server.port, username, password },
    close: () => closing ??= server.close(true),
  };
}
