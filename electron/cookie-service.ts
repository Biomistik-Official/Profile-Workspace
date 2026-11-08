import type { Cookie, CookiesSetDetails, Session } from 'electron';
import type { PortableCookie } from '../shared/types';
import { cookieUrl } from '../core/cookies';

export function portableCookie(c: Cookie): PortableCookie {
  if (!c.domain) throw new Error('Браузер вернул cookie без домена.');
  return { domain: c.domain, name: c.name, value: c.value, path: c.path || '/', secure: c.secure ?? false, httpOnly: c.httpOnly ?? false,
    hostOnly: c.hostOnly ?? !c.domain.startsWith('.'), sameSite: c.sameSite ?? 'unspecified',
    ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}) };
}
export function cookieDetails(c: PortableCookie): CookiesSetDetails {
  return { url: cookieUrl(c), name: c.name, value: c.value, path: c.path, secure: c.secure, httpOnly: c.httpOnly,
    sameSite: c.sameSite, ...(c.hostOnly ? {} : { domain: c.domain }),
    ...(c.expirationDate ? { expirationDate: c.expirationDate } : {}) };
}
export async function replaceOrMergeCookies(ses: Session, incoming: PortableCookie[], mode: 'merge' | 'replace'): Promise<number> {
  if (!incoming.length) throw new Error('Нет валидных cookies. Существующие данные не изменены.');
  if (!['merge', 'replace'].includes(mode)) throw new Error('Неизвестный режим импорта.');
  const previous = await ses.cookies.get({});
  try {
    if (mode === 'replace') await ses.clearStorageData({ storages: ['cookies'] });
    for (const c of incoming) await ses.cookies.set(cookieDetails(c));
    await ses.cookies.flushStore();
    return incoming.length;
  } catch {
    try {
      await ses.clearStorageData({ storages: ['cookies'] });
      for (const c of previous) await ses.cookies.set(cookieDetails(portableCookie(c)));
      await ses.cookies.flushStore();
    } catch { throw new Error('Импорт не завершён; восстановление cookies не удалось. Не закрывайте приложение, сохраните резервный экспорт.'); }
    throw new Error('Браузер отклонил импорт. Прежние cookies восстановлены.');
  }
}
