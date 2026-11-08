import { createServer, connect, type Socket } from 'node:net';

/** Controlled RFC 1928/1929 endpoint. Hostnames stay observable before resolution. */
export async function socksServer(username = 'service-user', password = 'service:p@ss/%', reject = false) {
  const sockets = new Set<Socket>();
  const destinations: { host: string; port: number }[] = [];
  const authentications: { username: string; password: string }[] = [];
  const server = createServer(client => {
    sockets.add(client); client.on('close', () => sockets.delete(client)); client.on('error', () => {});
    let pending = Buffer.alloc(0); let state = 0;
    const receive = (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      while (true) {
        if (state === 0) {
          if (pending.length < 2 || pending.length < 2 + pending[1]) return;
          if (pending[0] !== 5 || !pending.subarray(2, 2 + pending[1]).includes(2)) { client.end(Buffer.from([5, 255])); return; }
          pending = pending.subarray(2 + pending[1]); client.write(Buffer.from([5, 2])); state = 1;
        } else if (state === 1) {
          if (pending.length < 2 || pending.length < 3 + pending[1]) return;
          const userEnd = 2 + pending[1]; const end = userEnd + 1 + pending[userEnd];
          if (pending.length < end) return;
          const auth = { username: pending.subarray(2, userEnd).toString(), password: pending.subarray(userEnd + 1, end).toString() };
          authentications.push(auth); pending = pending.subarray(end);
          if (reject || auth.username !== username || auth.password !== password) { client.end(Buffer.from([1, 1])); return; }
          client.write(Buffer.from([1, 0])); state = 2;
        } else {
          if (pending.length < 5) return;
          const domain = pending[3] === 3;
          const end = domain ? 5 + pending[4] + 2 : 10;
          if (pending.length < end) return;
          if (pending[1] !== 1 || ![1, 3].includes(pending[3])) { client.destroy(); return; }
          const host = domain ? pending.subarray(5, end - 2).toString() : [...pending.subarray(4, 8)].join('.');
          const port = pending.readUInt16BE(end - 2);
          destinations.push({ host, port }); client.off('data', receive);
          const head = pending.subarray(end);
          const upstream = connect(port, host.endsWith('.invalid') ? '127.0.0.1' : host, () => {
            client.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]));
            if (head.length) upstream.write(head);
            client.pipe(upstream); upstream.pipe(client);
          });
          sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
          upstream.on('error', () => client.destroy()); client.on('close', () => upstream.destroy());
          return;
        }
      }
    };
    client.on('data', receive);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: (server.address() as { port: number }).port, destinations, authentications,
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
