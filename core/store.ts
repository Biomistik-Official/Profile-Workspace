import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Profile, ProfileDraft, ProxyDraft, ProxyInfo, Settings, WorkspaceSnapshot } from '../shared/types';
import { hostName, integer, tags, text, webUrl } from './validation';
interface SecretCodec { seal(value: string): Promise<string>; open(value: string): Promise<string> }
interface StoredProxy extends ProxyInfo { secret: string }
interface Data { version: 1; profiles: Profile[]; proxies: StoredProxy[]; settings: Settings }
const defaults: Settings = { maxConcurrent: 3, launchDelayMs: 600, defaultUrl: 'https://www.google.com/' };
export class WorkspaceStore {
  private tail: Promise<unknown> = Promise.resolve();
  private constructor(private file: string, private codec: SecretCodec, private data: Data) {}
  static async open(file: string, codec: SecretCodec): Promise<WorkspaceStore> {
    let data: Data;
    try {
      data = JSON.parse(await readFile(file, 'utf8'));
      if (data.version !== 1 || !Array.isArray(data.profiles) || !Array.isArray(data.proxies) || !data.settings) throw new Error('Неподдерживаемая структура данных.');
      for (const item of [...data.profiles, ...data.proxies]) if (!/^[a-f0-9-]{36}$/.test(item.id)) throw new Error('Повреждён идентификатор.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw new Error('Не удалось открыть workspace.json. Данные сохранены; проверьте файл или резервную копию.');
      data = { version: 1, profiles: [], proxies: [], settings: { ...defaults } };
    }
    return new WorkspaceStore(file, codec, data);
  }
  snapshot(): WorkspaceSnapshot {
    return structuredClone({ profiles: this.data.profiles, proxies: this.data.proxies.map(({ secret: _, ...p }) => p), settings: this.data.settings, runtime: {}, proxyChecks: {}, queue: { active: 0, pending: 0 } });
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
        createdAt: old?.createdAt ?? now, updatedAt: now, lastOpenedAt: old?.lastOpenedAt ?? null };
      if (old) data.profiles[data.profiles.indexOf(old)] = p; else data.profiles.push(p);
      return p;
    });
  }
  markOpened(id: string): Promise<void> { return this.mutate(data => { const p = data.profiles.find(p => p.id === id); if (!p) throw new Error('Профиль не найден.'); p.lastOpenedAt = new Date().toISOString(); }); }
  deleteProfiles(ids: string[]): Promise<void> { return this.mutate(data => { data.profiles = data.profiles.filter(p => !ids.includes(p.id)); }); }
  bulkUpdate(ids: string[], input: { tags?: string[]; proxyId?: string | null }): Promise<void> {
    return this.mutate(data => {
      if (input.proxyId && !data.proxies.some(p => p.id === input.proxyId)) throw new Error('Прокси не найден.');
      const newTags = input.tags === undefined ? undefined : tags(input.tags);
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
      if (input.protocol === 'socks5' && (username || password)) throw new Error('SOCKS5 с логином и паролем пока не поддерживается этим движком. Используйте HTTP(S) или SOCKS5 без авторизации.');
      const p: StoredProxy = { id: old?.id ?? randomUUID(), name: text(input.name, 'Название', 120), protocol: input.protocol, host: hostName(input.host), port: integer(input.port, 1, 65535, 'Порт'), username, hasPassword: !!password,
        secret: username || password ? await this.codec.seal(JSON.stringify({ username, password })) : '' };
      if (old) data.proxies[data.proxies.indexOf(old)] = p; else data.proxies.push(p);
      const { secret: _, ...publicProxy } = p; return publicProxy;
    });
  }
  deleteProxy(id: string): Promise<void> { return this.mutate(data => { if (data.profiles.some(p => p.proxyId === id)) throw new Error('Сначала отключите этот прокси в назначенных профилях.'); data.proxies = data.proxies.filter(p => p.id !== id); }); }
  saveSettings(input: Settings): Promise<void> { return this.mutate(data => { data.settings = { maxConcurrent: integer(input.maxConcurrent, 1, 20, 'Параллельные запуски'), launchDelayMs: integer(input.launchDelayMs, 0, 10000, 'Интервал'), defaultUrl: webUrl(input.defaultUrl) }; }); }
}
