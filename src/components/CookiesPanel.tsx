import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Cookie, Copy, Eye, EyeOff, RotateCw, ShieldCheck, Trash2 } from 'lucide-react';
import type { CookieFormat, CookiePreview, PortableCookie, Profile } from '../../shared/types';
import { Modal } from './Modal';
import { Presence } from './Presence';
export function CookiesPanel({ profile, stopped }: { profile: Profile; stopped: boolean }) {
  const [cookies, setCookies] = useState<PortableCookie[]>([]); const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(''); const [refresh, setRefresh] = useState(0); const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<CookiePreview | null>(null); const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [format, setFormat] = useState<CookieFormat>('json'); const [busy, setBusy] = useState(false); const [visible, setVisible] = useState<string | null>(null);
  useEffect(() => {
    let alive = true; setLoading(true); setMessage(''); setVisible(null);
    window.workspace.cookies(profile.id).then(data => { if (alive) setCookies(data); }).catch(e => { if (alive) setMessage(e.message); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [profile.id, refresh, stopped]);
  const groups = useMemo(() => {
    const map = new Map<string, PortableCookie[]>();
    for (const c of cookies) if (`${c.domain} ${c.name}`.toLowerCase().includes(search.toLowerCase())) map.set(c.domain, [...(map.get(c.domain) ?? []), c]);
    return [...map].sort(([a], [b]) => a.localeCompare(b));
  }, [cookies, search]);
  async function run(fn: () => Promise<void>) { setBusy(true); setMessage(''); try { await fn(); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); } }
  return <section className="cookies-panel" aria-label="Cookies профиля">
    <div className="section-heading"><div><h3>Cookies профиля</h3><p>{loading ? 'Загрузка…' : `${cookies.length} cookies · ${new Set(cookies.map(c => c.domain)).size} доменов`}</p></div><button className="icon-button" disabled={loading} aria-label="Обновить cookies" onClick={() => setRefresh(v => v + 1)}><RotateCw size={16} /></button></div>
    <div className="storage-notice"><ShieldCheck size={19} /><div><strong>Данные сохраняются</strong><p>Авторизация зависит от сайта.</p></div></div>
    <div className="cookie-actions"><button className="button secondary" disabled={!stopped || busy} onClick={() => void run(async () => { const p = await window.workspace.previewCookies(profile.id); if (p) { setPreview(p); setMode('merge'); } })}><ArrowDownToLine size={16} />Импорт</button><button className="button secondary" disabled={busy} onClick={() => void run(async () => { if (await window.workspace.exportCookies([profile.id], format)) setMessage('Файл cookies сохранён.'); })}><ArrowUpFromLine size={16} />Экспорт</button><select aria-label="Формат экспорта cookies" value={format} onChange={e => setFormat(e.target.value as CookieFormat)}><option value="json">JSON</option><option value="netscape">Netscape</option></select></div>
    <p className="form-hint">{!stopped ? 'Остановите профиль для импорта и очистки.' : 'Импорт JSON и Netscape с предварительной проверкой.'}</p>
    {format === 'netscape' && <p className="form-hint">Netscape не сохраняет SameSite. Для сохранения атрибутов выберите JSON.</p>}
    {message && <div className="inline-message" role="status">{message}</div>}
    <input className="cookie-search" aria-label="Поиск cookies" placeholder="Поиск по домену или имени" value={search} onChange={e => setSearch(e.target.value)} />
    {!loading && !cookies.length ? <div className="cookie-empty"><Cookie size={30} /><h4>Пока нет cookies</h4><p>Откройте сайт в этом профиле или импортируйте файл сессии.</p></div> : !loading && !groups.length ? <p className="muted">Cookies не найдены.</p> : <div className="domain-list">{groups.map(([domain, list]) => <details key={domain} className="domain-group"><summary><div><strong>{domain}</strong><span>{list.length} cookies</span></div><ChevronRight size={17} /></summary><div className="domain-cookies">{list.map((c, index) => {
      const key = `${domain}:${c.path}:${c.name}:${index}`; const shown = visible === key;
      return <div className="cookie-entry" key={key}><div className="cookie-entry-title"><strong title={c.name}>{c.name || '(без имени)'}</strong><button className="icon-button small-button" aria-label={`${shown ? 'Скрыть' : 'Показать'} значение ${c.name}`} onClick={() => setVisible(shown ? null : key)}>{shown ? <EyeOff size={14} /> : <Eye size={14} />}</button><button className="icon-button small-button" aria-label={`Копировать значение ${c.name}`} onClick={() => void navigator.clipboard.writeText(c.value).then(() => setMessage('Значение скопировано.')).catch(() => setMessage('Не удалось скопировать значение.'))}><Copy size={14} /></button></div><code>{shown ? c.value || '(пустое значение)' : '••••••••••••'}</code><span className="cookie-attributes">{c.secure ? 'Secure · ' : ''}{c.httpOnly ? 'HttpOnly · ' : ''}{c.sameSite !== 'unspecified' ? `SameSite=${c.sameSite} · ` : ''}{c.expirationDate ? new Date(c.expirationDate * 1000).toLocaleDateString('ru') : 'До закрытия браузера'}<br />Путь: {c.path} · {c.hostOnly ? 'Только этот хост' : 'С поддоменами'}</span></div>;
    })}</div></details>)}</div>}
    <footer className="cookie-footer"><p>Значения скрыты по умолчанию.<br />Экспорт содержит данные сессий.</p><button className="text-button danger" disabled={!stopped || busy || !cookies.length} onClick={() => void run(async () => { await window.workspace.clearCookies(profile.id); setRefresh(v => v + 1); })}><Trash2 size={14} />Очистить cookies</button></footer>
    <Presence present={!!preview}>{preview && <Modal title="Проверка импорта cookies" onClose={() => setPreview(null)}><div className="form-body"><p className="file-name">{preview.fileName}</p><div className="import-count"><strong>{preview.count}</strong><span>валидных cookies</span></div><label>Режим импорта<select value={mode} onChange={e => setMode(e.target.value as 'merge' | 'replace')}><option value="merge">Объединить с существующими</option><option value="replace">Заменить все cookies профиля</option></select></label><p className="form-hint">При объединении совпадения по домену, пути и имени заменяются. При полной замене потребуется дополнительное подтверждение.</p>{!!preview.errors.length && <details className="import-errors"><summary>Пропущено записей: {preview.errors.length}</summary>{preview.errors.map((e, i) => <p key={i}>{e}</p>)}</details>}{!!preview.warnings.length && <p className="form-hint">{preview.warnings.join('\n')}</p>}{!preview.count && <div className="error-box">Нет валидных cookies. Текущие данные не будут изменены.</div>}<footer className="modal-actions"><button className="button secondary" onClick={() => setPreview(null)}>Отмена</button><button className="button primary" disabled={!preview.count || busy} onClick={() => void run(async () => { const count = await window.workspace.importCookies(profile.id, preview.token, mode); setPreview(null); setRefresh(v => v + 1); setMessage(count ? `Импортировано cookies: ${count}.` : 'Импорт отменён.'); })}>{busy ? 'Импорт…' : 'Импортировать cookies'}</button></footer></div></Modal>}</Presence>
  </section>;
}
