import { useEffect, useState } from 'react';
import { Globe2, Plus, Trash2, X } from 'lucide-react';
import type { Site } from '../../shared/types';

export function SitesPanel({ close }: { close: () => void }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [name, setName] = useState(''); const [url, setUrl] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { void window.browser.sites().then(setSites).catch(e => setError(e.message)); }, []);
  async function run(fn: () => Promise<unknown>) {
    setBusy(true); setError('');
    try { await fn(); } catch (e) { setError((e as Error).message.replace(/^Error invoking remote method '[^']+': Error: /, '')); }
    finally { setBusy(false); }
  }
  return <aside className="sites-panel" aria-label="Сайты">
    <header><div><h2>Сайты</h2><p>В текущем профиле</p></div><button className="icon-button" aria-label="Закрыть панель сайтов" onClick={close}><X size={18} /></button></header>
    <div className="sites-list">{sites.map(site => <div className="site-row" key={site.id}>
      <button className="site-open" aria-label={`Открыть ${site.name}`} disabled={busy} onClick={() => void run(() => window.browser.openSite(site.url))}>
        <Globe2 size={18} /><span><strong>{site.name}</strong><small>{new URL(site.url).hostname}</small></span>
      </button><button className="icon-button danger" aria-label={`Удалить сайт ${site.name}`} disabled={busy} onClick={() => void run(async () => { await window.browser.deleteSite(site.id); setSites(await window.browser.sites()); })}><Trash2 size={15} /></button>
    </div>)}</div>
    <form className="site-form" onSubmit={e => { e.preventDefault(); void run(async () => {
      await window.browser.saveSite({ name, url }); setSites(await window.browser.sites()); setName(''); setUrl('');
    }); }}>
      <h3>Свой сайт</h3>
      <label>Название сайта<input value={name} onChange={e => setName(e.target.value)} required maxLength={120} placeholder="Например, мой канал" /></label>
      <label>Адрес сайта<input value={url} onChange={e => setUrl(e.target.value)} required type="url" maxLength={4096} placeholder="https://example.com" /></label>
      <button className="button secondary" disabled={busy}><Plus size={16} />Добавить сайт</button>
      <p className="form-hint">Ссылки общие для всех профилей. Каждый сайт открывается в новой вкладке с текущей сессией и прокси.</p>
    </form>
    {error && <p role="alert" className="error-box">{error}</p>}
  </aside>;
}
