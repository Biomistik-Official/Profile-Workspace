import { useState, type FormEvent } from 'react';
import type { BrowserEngine, Profile, ProfileDraft, ProxyInfo } from '../../shared/types';
import { Modal } from './Modal';
import { TagPicker } from './TagPicker';
export function ProfileForm({ profile, proxies, existingTags, defaultUrl, save, close }: { profile?: Profile; proxies: ProxyInfo[]; existingTags: string[]; defaultUrl: string; save: (draft: ProfileDraft) => Promise<void>; close: () => void }) {
  const [engine, setEngine] = useState<BrowserEngine>(profile ? profile.engine ?? 'chromium' : 'camoufox');
  const [locale, setLocale] = useState(profile?.nativeSettings?.locale ?? 'en-US');
  const [timezone, setTimezone] = useState(profile?.nativeSettings?.timezone ?? 'Europe/London');
  const [name, setName] = useState(profile?.name ?? ''); const [notes, setNotes] = useState(profile?.notes ?? '');
  const [tags, setTags] = useState(profile?.tags.join(', ') ?? ''); const [url, setUrl] = useState(profile?.startUrl ?? (defaultUrl === 'https://www.google.com/' ? 'https://duckduckgo.com/' : defaultUrl));
  const [proxyId, setProxyId] = useState(profile?.proxyId ?? ''); const [restore, setRestore] = useState(profile?.restoreSessionCookies ?? true);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setSaving(true); setError(''); try { await save({ id: profile?.id, name, notes, engine, ...(engine === 'camoufox' ? { nativeSettings: { locale, timezone } } : {}), tags: tags.split(',').map(t => t.trim()).filter(Boolean), startUrl: url, proxyId: proxyId || null, restoreSessionCookies: restore }); close(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  return <Modal title={profile ? 'Настройки профиля' : 'Новый профиль'} onClose={close} panel>
    <form onSubmit={submit} className="form-body">
      <label>Название профиля<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Например, Рабочий • основной" /></label>
      <label>Движок браузера<select aria-label="Движок браузера" value={engine} disabled={!!profile} onChange={e => setEngine(e.target.value as BrowserEngine)}><option value="camoufox">Camoufox · нативный отпечаток Firefox</option><option value="chromium">Chromium · совместимость с прежними профилями</option></select></label>
      {profile && <p className="form-hint">Движок закреплён за профилем. Данные аккаунта остаются в его собственном хранилище.</p>}
      {engine === 'camoufox' && <section className="native-settings"><div><h3>Нативный отпечаток</h3><p className="form-hint">Windows · сохранение параметров между запусками · WebRTC выключен</p></div><label>Язык браузера<select aria-label="Язык браузера" value={locale} onChange={e => setLocale(e.target.value)}><option value="en-US">English · United States</option><option value="en-GB">English · United Kingdom</option><option value="ru-RU">Русский</option></select></label><label>Часовой пояс IANA<input required value={timezone} onChange={e => setTimezone(e.target.value)} placeholder="Europe/London" /></label><p className="form-hint">Выберите регион, соответствующий прокси. Остальные параметры устройства создаёт Camoufox и сохраняет для этого профиля. Движок устанавливается отдельно в настройках.</p></section>}
      <label>Стартовая страница<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" /></label>
      <label>Прокси<select value={proxyId} onChange={e => setProxyId(e.target.value)}><option value="">Без прокси · прямое подключение</option>{proxies.map(p => <option key={p.id} value={p.id}>{p.name} · {p.protocol.toUpperCase()}</option>)}</select></label>
      <TagPicker value={tags} onChange={setTags} existing={existingTags} />
      <label>Заметка<textarea rows={3} maxLength={10000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Что важно помнить об этом профиле" /></label>
      <label className="check-label"><input type="checkbox" checked={restore} onChange={e => setRestore(e.target.checked)} /><span>Восстанавливать session cookies<small>Обычно живут до закрытия браузера. Сохраняются с шифрованием Windows.</small></span></label>
      <p className="form-hint">Постоянные cookies и данные сайтов сохраняются автоматически. Сайты могут запросить повторный вход.</p>
      {error && <div className="error-box" role="alert">{error}</div>}
      <footer className="modal-actions"><button type="button" className="button secondary" onClick={close}>Отмена</button><button className="button primary" disabled={saving}>{saving ? 'Сохранение…' : profile ? 'Сохранить изменения' : 'Создать профиль'}</button></footer>
    </form>
  </Modal>;
}
