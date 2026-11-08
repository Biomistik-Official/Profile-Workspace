import { useState, type FormEvent } from 'react';
import type { Profile, ProfileDraft, ProxyInfo } from '../../shared/types';
import { Modal } from './Modal';
export function ProfileForm({ profile, proxies, defaultUrl, save, close }: { profile?: Profile; proxies: ProxyInfo[]; defaultUrl: string; save: (draft: ProfileDraft) => Promise<void>; close: () => void }) {
  const [name, setName] = useState(profile?.name ?? ''); const [notes, setNotes] = useState(profile?.notes ?? '');
  const [tags, setTags] = useState(profile?.tags.join(', ') ?? ''); const [url, setUrl] = useState(profile?.startUrl ?? defaultUrl);
  const [proxyId, setProxyId] = useState(profile?.proxyId ?? ''); const [restore, setRestore] = useState(profile?.restoreSessionCookies ?? false);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setSaving(true); setError(''); try { await save({ id: profile?.id, name, notes, tags: tags.split(',').map(t => t.trim()).filter(Boolean), startUrl: url, proxyId: proxyId || null, restoreSessionCookies: restore }); close(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  return <Modal title={profile ? 'Настройки профиля' : 'Новый профиль'} onClose={close}>
    <form onSubmit={submit} className="form-body">
      <label>Название профиля<input autoFocus required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Например, Рабочий • основной" /></label>
      <label>Стартовая страница<input required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" /></label>
      <label>Прокси<select value={proxyId} onChange={e => setProxyId(e.target.value)}><option value="">Без прокси · прямое подключение</option>{proxies.map(p => <option key={p.id} value={p.id}>{p.name} · {p.protocol.toUpperCase()}</option>)}</select></label>
      <label>Теги через запятую<input value={tags} onChange={e => setTags(e.target.value)} placeholder="Работа, Магазин" /></label>
      <label>Заметка<textarea rows={3} maxLength={10000} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Что важно помнить об этом профиле" /></label>
      <label className="check-label"><input type="checkbox" checked={restore} onChange={e => setRestore(e.target.checked)} /><span>Восстанавливать session cookies<small>Обычно живут до закрытия браузера. Сохраняются с шифрованием Windows.</small></span></label>
      <p className="form-hint">Постоянные cookies и данные сайтов сохраняются автоматически. Сайты могут запросить повторный вход.</p>
      {error && <div className="error-box" role="alert">{error}</div>}
      <footer className="modal-actions"><button type="button" className="button secondary" onClick={close}>Отмена</button><button className="button primary" disabled={saving}>{saving ? 'Сохранение…' : profile ? 'Сохранить изменения' : 'Создать профиль'}</button></footer>
    </form>
  </Modal>;
}
