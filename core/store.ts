import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Profile, ProfileDraft, ProxyDraft, ProxyInfo, Settings, Site, WorkspaceSnapshot } from '../shared/types';
import { hostName, integer, tags, text, webUrl } from './validation';
interface SecretCodec { seal(value: string): Promise<string>; open(value: string): Promise<string> }
interface StoredProxy extends ProxyInfo { secret: string }
interface Data { version: 1; profiles: Profile[]; proxies: StoredProxy[]; settings: Settings; sites?: Site[]; groups?: string[] }
const defaultSites: Site[] = [
  { id: 'twitch', name: 'Twitch', url: 'https://www.twitch.tv/' },
  { id: 'tiktok', name: 'TikTok', url: 'https://www.tiktok.com/' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/' },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/' },
  { id: 'supercell', name: 'Supercell Creators', url: 'https://creators.supercell.com/' },
];
const defaults: Settings = { maxConcurrent: 3, launchDelayMs: 600, defaultUrl: 'https://duckduckgo.com/' };
export class WorkspaceStore {
  private tail: Promise<unknown> = Promise.resolve();
  private constructor(private file: string, private codec: SecretCodec, private data: Data) {}
  static async open(file: string, codec: SecretCodec): Promise<WorkspaceStore> {
    let data: Data;
    try {
      data = JSON.parse(await readFile(file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.proxies) || !data.settings) throw new Error('Неподдерживаемая структура данных.');
      for (const item of [...data.profiles, ...data.proxies]) if (!/^[a-f0-9-]{36}$/.test(item.id)) throw new Error('Повреждён идентификатор.');
      for (const profile of data.profiles) if (profile.engine !== undefined && !['chromium', 'camoufox'].includes(profile.engine)) throw new Error('Неизвестный движок профиля.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Не удалось открыть workspace.json. Данные сохранены; проверьте файл или резервную копию.');
      data = { version: 1, profiles: [], proxies: [], settings: { ...defaults } };
    }
    data.sites ??= structuredClone(defaultSites);
    data.groups = [...new Set([...(data.groups ?? []), ...data.profiles.flatMap(p => p.tags)])];
    return new WorkspaceStore(file, codec, data);
  }
  snapshot(): WorkspaceSnapshot {
    return structuredClone({ profiles: this.data.profiles, proxies: this.data.proxies.map(({ secret: _, ...p }) => p), settings: this.data.settings, sites: this.data.sites!, groups: this.data.groups!, runtime: {}, proxyChecks: {}, queue: { active: 0, pending: 0 } });
  }
  profile(id: string): Profile { const p = this.data.profiles.find(p => p.id === id); if (!p) throw new Error('Профиль не найден.'); return structuredClone(p); }
  proxy(id: string): ProxyInfo { const p = this.snapshot().proxies.find(p => p.id === id); if (!p) throw new Error('Прокси не найден.'); return p; }
  async proxyCredentials(id: string): Promise<{ username: string; password: string }> {
    const p = this.data.proxies.find(p => p.id === id); if (!p) throw new Error('Прокси не найден.');
    return p.secret ? JSON.parse(await this.codec.open(p.secret)) : { username: '', password: '' };
  }
  private mutate<T>(fn: (data: Data) => T | Promise<T>): Promise<T> {
    const operation = this.tail.then(async () => {
      const next = structuredClone(this.data); const result = await fn(next);
      await mkdir(dirname(this.file), { recursive: true });
      const pending = `${this.file}.tmp`;
      await writeFile(pending, JSON.stringify(next, null, 2), { mode: 0o600 });
      // The old file stays intact until the complete replacement is ready.
      await rename(pending, this.file); this.data = next; return structuredClone(result);
    });
    this.tail = operation.catch(() => {}); return operation;
  }
  saveProfile(input: ProfileDraft): Promise<Profile> {
    return this.mutate(data => {
      const old = input.id ? data.profiles.find(p => p.id === input.id) : undefined;
      if (input.id && !old) throw new Error('Профиль не найден.');
      const engine = input.engine ?? old?.engine ?? 'chromium';
      if (!['chromium', 'camoufox'].includes(engine)) throw new Error('Неизвестный движок браузера.');
      if (old && engine !== (old.engine ?? 'chromium')) throw new Error('Нельзя менять движок существующего профиля: создайте отдельный профиль, чтобы сохранить аккаунт.');
      let nativeSettings = input.nativeSettings ?? old?.nativeSettings;
      if (engine === 'camoufox') {
        nativeSettings ??= { locale: 'en-US', timezone: 'Europe/London' };
        if (!['ru-RU', 'en-US', 'en-GB'].includes(nativeSettings.locale)) throw new Error('Выберите русский или английский язык браузера.');
        try { new Intl.DateTimeFormat('en', { timeZone: nativeSettings.timezone }).format(); } catch { throw new Error('Неизвестный часовой пояс IANA.'); }
        if (typeof nativeSettings.timezone !== 'string' || nativeSettings.timezone.length > 80) throw new Error('Неверный часовой пояс.');
      }
      const name = text(input.name, 'Название', 120);
      const proxyId = input.proxyId === undefined ? old?.proxyId ?? null : input.proxyId;
      if (proxyId && !data.proxies.some(p => p.id === proxyId)) throw new Error('Выбранный прокси не существует.');
      const notes = input.notes ?? old?.notes ?? '';
      if (typeof notes !== 'string' || notes.length > 10000) throw new Error('Заметка: не более 10 000 символов.');
      if (input.restoreSessionCookies !== undefined && typeof input.restoreSessionCookies !== 'boolean') throw new Error('Неверная настройка сессии.');
      const now = new Date().toISOString();
      const p: Profile = { id: old?.id ?? randomUUID(), name, notes, proxyId,
        tags: tags(input.tags ?? old?.tags ?? []), startUrl: webUrl(input.startUrl ?? old?.startUrl ?? data.settings.defaultUrl),
        restoreSessionCookies: input.restoreSessionCookies ?? old?.restoreSessionCookies ?? false,
        createdAt: old?.createdAt ?? now, updatedAt: now, lastOpenedAt: old?.lastOpenedAt ?? null,
        ...(engine === 'camoufox' ? { engine, nativeSettings } : old?.engine ? { engine } : {}) };
      if (old) data.profiles[data.profiles.indexOf(old)] = p; else data.profiles.push(p);
      data.groups = [...new Set([...data.groups!, ...p.tags])];
      return p;
    });
  }
  saveGroup(input: { name: string; previousName?: string }): Promise<void> {
    return this.mutate(data => {
      const name = text(input.name, 'Название группы', 40);
      if (name.includes(',')) throw new Error('Название группы не должно содержать запятую.');
      const previous = input.previousName;
      if (previous !== undefined && !data.groups!.includes(previous)) throw new Error('Группа не найдена.');
      if (name !== previous && data.groups!.includes(name)) throw new Error('Группа с таким названием уже существует.');
      if (previous === undefined) data.groups!.push(name);
      else {
        data.groups = data.groups!.map(g => g === previous ? name : g);
        for (const p of data.profiles.filter(p => p.tags.includes(previous))) {
          p.tags = p.tags.map(tag => tag === previous ? name : tag);
          p.updatedAt = new Date().toISOString();
        }
      }
    });
  }
  deleteGroup(name: string): Promise<void> {
    return this.mutate(data => {
      if (!data.groups!.includes(name)) throw new Error('Группа не найдена.');
      data.groups = data.groups!.filter(g => g !== name);
      for (const p of data.profiles.filter(p => p.tags.includes(name))) {
        p.tags = p.tags.filter(tag => tag !== name);
        p.updatedAt = new Date().toISOString();
      }
    });
  }
  saveSite(input: { name: string; url: string }): Promise<Site> {
    return this.mutate(data => {
      const site = { id: randomUUID(), name: text(input.name, 'Название', 120), url: webUrl(input.url) };
      data.sites!.push(site); return site;
    });
  }
  deleteSite(id: string): Promise<void> { return this.mutate(data => { data.sites = data.sites!.filter(s => s.id !== id); }); }
  markOpened(id: string): Promise<void> { return this.mutate(data => { const p = data.profiles.find(p => p.id === id); if (!p) throw new Error('Профиль не найден.'); p.lastOpenedAt = new Date().toISOString(); }); }
  deleteProfiles(ids: string[]): Promise<void> { return this.mutate(data => { data.profiles = data.profiles.filter(p => !ids.includes(p.id)); }); }
  bulkUpdate(ids: string[], input: { tags?: string[]; proxyId?: string | null }): Promise<void> {
    return this.mutate(data => {
      if (input.proxyId && !data.proxies.some(p => p.id === input.proxyId)) throw new Error('Прокси не найден.');
      const newTags = input.tags === undefined ? undefined : tags(input.tags);
      if (newTags) data.groups = [...new Set([...data.groups!, ...newTags])];
      for (const p of data.profiles.filter(p => ids.includes(p.id))) {
        if (newTags) p.tags = newTags;
        if (input.proxyId !== undefined) p.proxyId = input.proxyId;
        p.updatedAt = new Date().toISOString();
      }
    });
  }
  saveProxy(input: ProxyDraft): Promise<ProxyInfo> {
    return this.mutate(async data => {
      const old = input.id ? data.proxies.find(p => p.id === input.id) : undefined;
      if (input.id && !old) throw new Error('Прокси не найден.');
      if (!['http', 'https', 'socks5'].includes(input.protocol)) throw new Error('Неизвестный протокол прокси.');
      const username = input.username ?? old?.username ?? '';
      if (typeof username !== 'string' || username.length > 500 || input.password !== undefined && (typeof input.password !== 'string' || input.password.length > 2000)) throw new Error('Неверные учётные данные прокси.');
      const previous = old?.secret ? JSON.parse(await this.codec.open(old.secret)) : { password: '' };
      const password = input.clearPassword ? '' : input.password === undefined || input.password === '' ? previous.password : input.password;
      if (input.protocol === 'socks5' && (Buffer.byteLength(username) > 255 || Buffer.byteLength(password) > 255)) throw new Error('SOCKS5: логин и пароль должны занимать не более 255 байт каждый.');
      const p: StoredProxy = { id: old?.id ?? randomUUID(), name: text(input.name, 'Название', 120), protocol: input.protocol, host: hostName(input.host), port: integer(input.port, 1, 65535, 'Порт'), username, hasPassword: !!password,
        secret: username || password ? await this.codec.seal(JSON.stringify({ username, password })) : '' };
      if (old) data.proxies[data.proxies.indexOf(old)] = p; else data.proxies.push(p);
      const { secret: _, ...publicProxy } = p; return publicProxy;
    });
  }
  deleteProxy(id: string): Promise<void> { return this.mutate(data => { if (data.profiles.some(p => p.proxyId === id)) throw new Error('Сначала отключите этот прокси в назначенных профилях.'); data.proxies = data.proxies.filter(p => p.id !== id); }); }
  saveSettings(input: Settings): Promise<void> { return this.mutate(data => { data.settings = { maxConcurrent: integer(input.maxConcurrent, 1, 20, 'Параллельные запуски'), launchDelayMs: integer(input.launchDelayMs, 0, 10000, 'Интервал'), defaultUrl: webUrl(input.defaultUrl) }; }); }
}
