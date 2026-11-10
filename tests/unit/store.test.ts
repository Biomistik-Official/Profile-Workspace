import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { WorkspaceStore } from '../../core/store';
const paths: string[] = [];
const secrets = { seal: async (s: string) => Buffer.from(s).toString('base64'), open: async (s: string) => Buffer.from(s, 'base64').toString() };
afterEach(async () => { await Promise.all(paths.splice(0).map(p => rm(p, { recursive: true, force: true }))); });
async function setup() { const dir = await mkdtemp(join(tmpdir(), 'workspace-unit-')); paths.push(dir); const file = join(dir, 'workspace.json'); return { file, store: await WorkspaceStore.open(file, secrets) }; }
describe('workspace persistence', () => {
  it('persists empty groups and keeps tags after their last assignment is removed', async () => {
    const { file, store } = await setup();
    await store.saveGroup({ name: 'Пустая' });
    const profile = await store.saveProfile({ name: 'One', tags: ['Работа'] });
    await store.saveProfile({ ...profile, tags: [] });
    await store.bulkUpdate([profile.id], { tags: ['Bulk'] });
    await store.deleteProfiles([profile.id]);
    expect((await WorkspaceStore.open(file, secrets)).snapshot().groups).toEqual(['Пустая', 'Работа', 'Bulk']);
  });
  it('migrates legacy tags and atomically renames and deletes groups without deleting profiles', async () => {
    const { file, store } = await setup();
    const p = await store.saveProfile({ name: 'Old', tags: ['Work', 'Other'] });
    const old = JSON.parse(await readFile(file, 'utf8')); delete old.groups;
    await writeFile(file, JSON.stringify(old));
    const loaded = await WorkspaceStore.open(file, secrets);
    expect(loaded.snapshot().groups).toEqual(['Work', 'Other']);
    await loaded.saveGroup({ name: 'Renamed', previousName: 'Work' });
    expect(loaded.profile(p.id).tags).toEqual(['Renamed', 'Other']);
    await expect(loaded.saveGroup({ name: 'Other', previousName: 'Renamed' })).rejects.toThrow();
    await expect(loaded.saveGroup({ name: '   ' })).rejects.toThrow();
    await expect(loaded.saveGroup({ name: 'a,b' })).rejects.toThrow();
    await expect(loaded.saveGroup({ name: 'x'.repeat(41) })).rejects.toThrow();
    await expect(loaded.saveGroup({ name: 'Other' })).rejects.toThrow();
    await loaded.deleteGroup('Renamed');
    await loaded.deleteGroup('Other');
    const reopened = await WorkspaceStore.open(file, secrets);
    expect(reopened.snapshot().groups).toEqual([]);
    expect(reopened.profile(p.id)).toMatchObject({ name: 'Old', tags: [] });
  });
  it('loads older workspaces with default sites and preserves an intentionally empty site list', async () => {
    const { file, store } = await setup();
    await store.saveProfile({ name: 'Existing profile' });
    const old = JSON.parse(await readFile(file, 'utf8')); delete old.sites;
    await writeFile(file, JSON.stringify(old));
    const loaded = await WorkspaceStore.open(file, secrets);
    expect(loaded.snapshot().profiles[0].name).toBe('Existing profile');
    expect(loaded.snapshot().sites).toHaveLength(5);
    for (const site of loaded.snapshot().sites) await loaded.deleteSite(site.id);
    expect((await WorkspaceStore.open(file, secrets)).snapshot().sites).toEqual([]);
  });
  it('adds, persists and removes custom sites without changing profiles or settings', async () => {
    const { file, store } = await setup();
    expect(store.snapshot().sites.map(s => s.name)).toEqual(['Twitch', 'TikTok', 'YouTube', 'Instagram', 'Supercell Creators']);
    const site = await store.saveSite({ name: 'Мой сайт', url: 'https://example.com' });
    await store.saveSettings({ maxConcurrent: 2, launchDelayMs: 0, defaultUrl: 'https://example.org/' });
    const loaded = await WorkspaceStore.open(file, secrets);
    expect(loaded.snapshot().sites.at(-1)).toEqual({ ...site, url: 'https://example.com/' });
    await expect(loaded.saveSite({ name: 'Bad', url: 'javascript:alert(1)' })).rejects.toThrow();
    await loaded.deleteSite(site.id);
    expect((await WorkspaceStore.open(file, secrets)).snapshot().sites).toHaveLength(5);
  });
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

it('opens 0.1.7 metadata without regenerating or applying fingerprint migrations', async () => {
  const { file, store } = await setup();
  const profile = await store.saveProfile({ name: 'Legacy', notes: 'Keep note', tags: ['Мой'], restoreSessionCookies: true });
  const original = JSON.parse(await readFile(file, 'utf8'));
  original.profiles[0].fingerprint = { id: profile.id, language: 'nl-NL', timezone: 'Europe/London', screenWidth: 1920, screenHeight: 1080, hardwareConcurrency: 4, userAgent: '' };
  await writeFile(file, JSON.stringify(original));
  const before = await readFile(file, 'utf8');
  const loaded = await WorkspaceStore.open(file, secrets);
  expect(loaded.profile(profile.id)).toMatchObject({ id: profile.id, name: 'Legacy', notes: 'Keep note', tags: ['Мой'], restoreSessionCookies: true });
  expect(await readFile(file, 'utf8')).toBe(before);
  await loaded.saveSettings({ ...loaded.snapshot().settings, maxConcurrent: 4 });
  expect(JSON.parse(await readFile(file, 'utf8')).profiles).toEqual(original.profiles);
});
