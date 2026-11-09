import type { Fingerprint } from '../shared/types';
import { randomInt, randomUUID } from 'node:crypto';
import { integer, text } from './validation';
const regions = [
  ['en-GB', 'Europe/London'], ['en-US', 'America/New_York'], ['en-US', 'America/Los_Angeles'],
  ['en-GB', 'Europe/Amsterdam'], ['en-GB', 'Europe/Berlin'], ['en-GB', 'Europe/Stockholm'],
  ['en-GB', 'Europe/Paris'], ['en-GB', 'Europe/Madrid'], ['en-GB', 'Europe/Warsaw'],
  ['en-US', 'America/Sao_Paulo'], ['ru-RU', 'Europe/Moscow'], ['en-CA', 'America/Toronto'],
];
const screens = [[1366, 768], [1440, 900], [1536, 864], [1600, 900], [1920, 1080], [1920, 1200], [2560, 1440], [3840, 2160]];
const cpus = [2, 4, 6, 8, 12, 16];
function key(fp: Fingerprint): string { return JSON.stringify([fp.language, fp.timezone, fp.screenWidth, fp.screenHeight, fp.hardwareConcurrency, fp.userAgent]); }
export function generateFingerprint(existing: Fingerprint[]): Fingerprint {
  const used = new Set(existing.map(key)); const count = regions.length * screens.length * cpus.length; const start = randomInt(count);
  let candidate!: Fingerprint;
  for (let n = 0; n < count; n++) {
    const index = (start + n) % count; const [language, timezone] = regions[Math.floor(index / (screens.length * cpus.length))];
    const [screenWidth, screenHeight] = screens[Math.floor(index / cpus.length) % screens.length];
    candidate = { id: randomUUID(), language, timezone, screenWidth, screenHeight, hardwareConcurrency: cpus[index % cpus.length], userAgent: '' };
    if (!used.has(key(candidate))) return candidate;
  }
  // Parameter combinations are finite; do not impose an artificial profile limit.
  return candidate;
}
export function validateFingerprint(input: unknown): Fingerprint {
  if (!input || typeof input !== 'object') throw new Error('Неверные параметры отпечатка.');
  const fp = input as Fingerprint;
  if (typeof fp.id !== 'string' || !/^[a-f0-9-]{36}$/.test(fp.id)) throw new Error('Неверный идентификатор отпечатка.');
  const language = canonicalLanguage(fp.language);
  if (!/^(ru|en)(-|$)/.test(language)) throw new Error('Выберите русский или английский язык.');
  const timezone = text(fp.timezone, 'Часовой пояс', 100);
  try { new Intl.DateTimeFormat('en', { timeZone: timezone }); } catch { throw new Error('Неверный часовой пояс.'); }
  if (typeof fp.userAgent !== 'string' || fp.userAgent.length > 512 || /[\x00-\x1f\x7f]/.test(fp.userAgent)) throw new Error('User-Agent: до 512 символов без управляющих символов.');
  return { id: fp.id, language, timezone, screenWidth: integer(fp.screenWidth, 640, 7680, 'Ширина экрана'),
    screenHeight: integer(fp.screenHeight, 480, 4320, 'Высота экрана'), hardwareConcurrency: integer(fp.hardwareConcurrency, 1, 64, 'Логических ядер'), userAgent: fp.userAgent.trim() };
}
function canonicalLanguage(input: unknown): string {
  const value = text(input, 'Язык', 40);
  if (!/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(value)) throw new Error('Неверный язык.');
  try { return Intl.getCanonicalLocales(value)[0]; } catch { throw new Error('Неверный язык.'); }
}
export function migrateFingerprintLanguage(input: unknown): string {
  const language = canonicalLanguage(input);
  return /^(ru|en)(-|$)/.test(language) ? language : 'en-US';
}
