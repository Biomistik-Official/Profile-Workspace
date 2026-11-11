import { useState, type FormEvent } from 'react';
import { Bookmark, Plus, Trash2 } from 'lucide-react';
import type { Site } from '../../shared/types';
export function BookmarksSettings({ sites }: { sites: Site[] }) {
  const [name, setName] = useState(''), [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await window.workspace.saveSite({ name, url }); setName(''); setUrl(''); }
    catch (error) { setError((error as Error).message); } finally { setBusy(false); }
  }
  return <section className="settings-card"><div className="settings-heading"><Bookmark size={21} /><div><h2>Общие закладки</h2><p>Одни и те же ссылки в каждой сессии</p></div></div><p className="form-hint">В Chromium — панель «Сайты». В Camoufox — папка «Profile Workspace» на панели закладок; обновляется при запуске сессии. Собственные закладки браузера сохраняются отдельно.</p><div className="shared-bookmarks">{sites.map(site => <div key={site.id}><span><strong>{site.name}</strong><small>{site.url}</small></span><button className="icon-button danger" aria-label={`Удалить общую закладку ${site.name}`} onClick={() => void window.workspace.deleteSite(site.id).catch(e => setError(e.message))}><Trash2 size={16} /></button></div>)}</div><form onSubmit={submit} className="bookmark-form"><div className="form-grid"><label>Название закладки<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label><label>Адрес закладки<input required type="url" value={url} onChange={e => setUrl(e.target.value)} /></label></div><div><button className="button secondary" disabled={busy}><Plus size={16} />Добавить закладку</button></div>{error && <p className="error-box" role="alert">{error}</p>}</form></section>;
}
