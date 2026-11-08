import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, RotateCw, Plus, X, Globe2 } from 'lucide-react';
import type { BrowserState } from '../../shared/types';
export function BrowserShell() {
  const [state, setState] = useState<BrowserState>({ profileName: '', tabs: [], activeId: 0, canGoBack: false, canGoForward: false });
  const [address, setAddress] = useState(''); const [error, setError] = useState('');
  const active = state.tabs.find(t => t.id === state.activeId);
  useEffect(() => { window.browser.state().then(setState).catch(() => {}); return window.browser.onChange(setState); }, []);
  useEffect(() => { setAddress(active?.url ?? ''); }, [active?.url, active?.id]);
  useEffect(() => { document.title = state.profileName ? `${state.profileName} · Profile Workspace` : 'Profile Workspace'; }, [state.profileName]);
  async function act(action: 'back' | 'forward' | 'reload' | 'newTab') { try { setError(''); await window.browser.action(action); } catch (e) { setError((e as Error).message); } }
  async function navigate(e: FormEvent) { e.preventDefault(); try { setError(''); await window.browser.navigate(address); } catch (e) { setError((e as Error).message); } }
  return <div className="browser-shell">
    <div className="browser-tabs"><span className="browser-profile" title={state.profileName}><span className="brand-mark small" />{state.profileName}</span>
      <div className="browser-tab-list">{state.tabs.map(t => <div className={`browser-tab ${state.activeId === t.id ? 'active' : ''}`} key={t.id}>
        <button className="tab-label" onClick={() => void window.browser.selectTab(t.id)}><Globe2 size={13} className={t.loading ? 'spin' : ''} /><span>{t.title}</span></button>
        <button aria-label={`Закрыть вкладку ${t.title}`} className="tab-close" onClick={() => void window.browser.closeTab(t.id)}><X size={13} /></button>
      </div>)}</div>
      <button className="icon-button" aria-label="Новая вкладка" onClick={() => void act('newTab')}><Plus size={18} /></button>
    </div>
    <form className="address-toolbar" onSubmit={navigate}><button type="button" className="icon-button" aria-label="Назад" disabled={!state.canGoBack} onClick={() => void act('back')}><ArrowLeft size={18} /></button><button type="button" className="icon-button" aria-label="Вперёд" disabled={!state.canGoForward} onClick={() => void act('forward')}><ArrowRight size={18} /></button><button type="button" className="icon-button" aria-label="Обновить страницу" onClick={() => void act('reload')}><RotateCw size={17} /></button><input aria-label="Адрес сайта или поисковый запрос" value={address} onChange={e => setAddress(e.target.value)} onFocus={e => e.target.select()} placeholder="Адрес сайта или поисковый запрос" /><button className="button compact secondary">Перейти</button></form>
    {error && <div role="alert" className="browser-error">{error}</div>}
  </div>;
}
