import type { CookieFormat, CookieParseResult, PortableCookie } from '../shared/types';
import { hostName } from './validation';

export function cookieUrl(c: PortableCookie): string { return `${c.secure ? 'https' : 'http'}://${c.domain.replace(/^\./, '')}${c.path}`; }
export function cookieKey(c: PortableCookie): string { return `${c.domain}\t${c.path}\t${c.name}`; }
function normalize(raw: unknown): PortableCookie {
  if (!raw || typeof raw !== 'object') throw new Error('ожидается объект cookie');
  const r = raw as Record<string, unknown>;
  if (r.partitionKey || r.partitioned) throw new Error('partitioned cookies пока не поддерживаются; запись пропущена');
  if (typeof r.domain !== 'string') throw new Error('отсутствует домен');
  const host = hostName(r.domain.replace(/^\./, ''));
  if (typeof r.name !== 'string' || /[\x00-\x20\x7f;=\t\r\n]/.test(r.name)) throw new Error('неверное имя');
  if (typeof r.value !== 'string' || /[\x00\r\n\t]/.test(r.value)) throw new Error('неверное значение');
  for (const key of ['secure', 'httpOnly', 'hostOnly']) if (r[key] !== undefined && typeof r[key] !== 'boolean') throw new Error(`${key}: ожидается true или false`);
  const path = r.path ?? '/';
  if (typeof path !== 'string' || !path.startsWith('/') || /[\r\n\t\x00]/.test(path)) throw new Error('неверный путь');
  const sameSite = r.sameSite === 'none' ? 'no_restriction' : r.sameSite ?? 'unspecified';
  if (!['unspecified', 'no_restriction', 'lax', 'strict'].includes(sameSite as string)) throw new Error('неверный SameSite');
  const c: PortableCookie = {
    domain: r.domain.startsWith('.') ? `.${host}` : host, name: r.name, value: r.value, path,
    secure: r.secure === true, httpOnly: r.httpOnly === true,
    hostOnly: r.hostOnly === undefined ? !r.domain.startsWith('.') : r.hostOnly === true,
    sameSite: sameSite as PortableCookie['sameSite'],
  };
  const expiry = r.expirationDate ?? r.expires;
  if (expiry !== undefined && expiry !== -1 && expiry !== 0 && r.session !== true) {
    if (typeof expiry !== 'number' || !Number.isFinite(expiry) || expiry < 0) throw new Error('неверный срок действия');
    c.expirationDate = expiry;
    if (expiry <= Date.now() / 1000) throw new Error('срок действия истёк');
  }
  if (c.sameSite === 'no_restriction' && !c.secure) throw new Error('SameSite=None требует Secure');
  if (c.hostOnly) c.domain = host;
  else c.domain = `.${host}`;
  return c;
}
export function parseCookies(input: string): CookieParseResult {
  if (Buffer.byteLength(input) > 10 * 1024 * 1024) throw new Error('Файл cookies больше 10 МБ.');
  const source = input.replace(/^\uFEFF/, '');
  const result: CookieParseResult = { cookies: [], errors: [], warnings: [] };
  if (!source.trim()) return result;
  let rows: unknown[];
  if (source.trimStart().startsWith('[') || source.trimStart().startsWith('{')) {
    let parsed: unknown;
    try { parsed = JSON.parse(source); } catch { throw new Error('Не удалось прочитать JSON. Проверьте формат файла.'); }
    const array = Array.isArray(parsed) ? parsed : (parsed as { cookies?: unknown })?.cookies;
    if (!Array.isArray(array)) throw new Error('Ожидается массив cookies или объект с полем cookies.');
    rows = array;
  } else {
    rows = source.split(/\r?\n/).filter(line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_'))).map(line => {
      const httpOnly = line.startsWith('#HttpOnly_');
      const parts = (httpOnly ? line.slice(10) : line).split('\t');
      if (parts.length !== 7 || !['TRUE', 'FALSE'].includes(parts[1]) || !['TRUE', 'FALSE'].includes(parts[3]) || !/^\d+$/.test(parts[4])) return null;
      return { domain: parts[0], hostOnly: parts[1] === 'FALSE', path: parts[2], secure: parts[3] === 'TRUE', expirationDate: Number(parts[4]), name: parts[5], value: parts[6], httpOnly };
    });
  }
  const map = new Map<string, PortableCookie>();
  rows.forEach((raw, index) => {
    try { const c = normalize(raw); const key = cookieKey(c); if (map.has(key)) result.warnings.push(`Запись ${index + 1}: повтор заменяет предыдущее значение.`); map.set(key, c); }
    catch (e) { result.errors.push(`Запись ${index + 1}: ${(e as Error).message}.`); }
  });
  result.cookies = [...map.values()];
  return result;
}
export function serializeCookies(cookies: PortableCookie[], format: CookieFormat): string {
  if (format === 'json') return JSON.stringify(cookies, null, 2);
  if (format !== 'netscape') throw new Error('Неизвестный формат cookies.');
  return '# Netscape HTTP Cookie File\n# SameSite is not supported by this format.\n' + cookies.map(c => {
    if (/[\r\n\t]/.test(c.value + c.name + c.path)) throw new Error('Эти cookies нельзя записать в Netscape; используйте JSON.');
    return `${c.httpOnly ? '#HttpOnly_' : ''}${c.domain}\t${c.hostOnly ? 'FALSE' : 'TRUE'}\t${c.path}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate ? Math.floor(c.expirationDate) : 0}\t${c.name}\t${c.value}`;
  }).join('\n') + '\n';
}
