import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceStore } from '../../core/store';
const paths: string[] = [];
const secrets = { seal: async (s: string) => Buffer.from(s).toString('base64'), open: async (s: string) => Buffer.from(s, 'base64').toString() };
afterEach(async () => { await Promise.all(paths.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'workspace-unit-')); paths.push(dir); const file = join(dir, 'workspace.json'); return { file, store: await WorkspaceStore.open(file, secrets) }; }
describe('workspace persistence', () => {
  it('persists authenticated SOCKS5 credentials encrypted and preserves the password on edit', async () => {
    const { file, store } = await setup();
    const draft = { name: 'Nord', protocol: 'socks5' as const, host: 'nl.socks.nordhold.net', port: 1080, username: 'service-user' };
    const proxy = await store.saveProxy({ ...draft, password: 'socks-private-secret' });
    await store.saveProxy({ ...draft, id: proxy.id, name: 'Renamed' });
    const loaded = await WorkspaceStore.open(file, secrets);
    expect(await loaded.proxyCredentials(proxy.id)).toEqual({ username: 'service-user', password: 'socks-private-secret' });
    expect(await readFile(file, 'utf8')).not.toContain('socks-private-secret');
    expect(JSON.stringify(loaded.snapshot())).not.toContain('socks-private-secret');
  });
  it('enforces SOCKS5 credential byte limits, including multibyte text', async () => {
    const { store } = await setup();
    const draft = { name: 'Socks', protocol: 'socks5' as const, host: 'localhost', port: 1080 };
    await expect(store.saveProxy({ ...draft, username: 'u'.repeat(255), password: 'p'.repeat(255) })).resolves.toMatchObject({ hasPassword: true });
    await expect(store.saveProxy({ ...draft, username: 'я'.repeat(128), password: 'p' })).rejects.toThrow('255');
    await expect(store.saveProxy({ ...draft, username: 'u', password: 'p'.repeat(256) })).rejects.toThrow('255');
  });
  it('persists concurrent profile writes and does not impose a profile count limit', async () => {
    const { file, store } = await setup();
    await Promise.all(Array.from({ length: 35 }, (_, i) => store.saveProfile({ name: `Profile ${i}`, notes: 'note', tags: ['work', 'work'] })));
    const loaded = await WorkspaceStore.open(file, secrets);
    expect(loaded.snapshot().profiles).toHaveLength(35);
    expect(loaded.snapshot().profiles[0].tags).toEqual(['work']);
    const snap = loaded.snapshot(); snap.profiles[0].name = 'mutated';
    expect(loaded.snapshot().profiles[0].name).toBe('Profile 0');
  });
  it('keeps password out of metadata and public snapshots and preserves it on edit', async () => {
    const { file, store } = await setup();
    const proxy = await store.saveProxy({ name: 'Proxy', protocol: 'http', host: '127.0.0.1', port: 8080, username: 'user', password: 'private-test-secret' });
    expect(await readFile(file, 'utf8')).not.toContain('private-test-secret');
    expect(JSON.stringify(store.snapshot())).not.toContain('private-test-secret');
    await store.saveProxy({ id: proxy.id, name: 'Renamed', protocol: 'http', host: '127.0.0.1', port: 8080, username: 'user' });
    expect(await store.proxyCredentials(proxy.id)).toEqual({ username: 'user', password: 'private-test-secret' });
  });
  it('rejects invalid URLs, missing proxy references and deletion of assigned proxies', async () => {
    const { store } = await setup();
    await expect(store.saveProfile({ name: 'X', startUrl: 'file:///C:/Windows' })).rejects.toThrow();
    await expect(store.saveProfile({ name: 'X', proxyId: 'missing' })).rejects.toThrow();
    const proxy = await store.saveProxy({ name: 'P', protocol: 'socks5', host: 'localhost', port: 1080 });
    await store.saveProfile({ name: 'X', proxyId: proxy.id });
    await expect(store.deleteProxy(proxy.id)).rejects.toThrow();
    await expect(store.saveProxy({ name: 'P', protocol: 'http', host: 'host/path', port: 1 })).rejects.toThrow();
    await expect(store.saveSettings({ maxConcurrent: 0, launchDelayMs: 0, defaultUrl: 'https://example.com' })).rejects.toThrow();
  });
});
