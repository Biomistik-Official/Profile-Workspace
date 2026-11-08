import { useState } from 'react';
import { X, Play, Square, Copy, Pencil, Trash2, ExternalLink, Globe2, Tag, Clock3 } from 'lucide-react';
import type { Profile, WorkspaceSnapshot } from '../../shared/types';
import { Status } from './ProfileTable';
import { CookiesPanel } from './CookiesPanel';
export function ProfileDetail({ profile, snapshot, close, edit, launch, stop, duplicate, remove }: {
  profile: Profile; snapshot: WorkspaceSnapshot; close: () => void; edit: () => void;
  launch: () => void; stop: () => void; duplicate: () => void; remove: () => void;
}) {
  const [tab, setTab] = useState('overview'); const state = snapshot.runtime[profile.id]?.status ?? 'stopped';
  const stopped = state === 'stopped' || state === 'error'; const proxy = snapshot.proxies.find(p => p.id === profile.proxyId);
  return <aside className="profile-detail" aria-label={`Профиль ${profile.name}`}>
    <header className="detail-header"><div className="eyebrow">Выбранный профиль</div><button className="icon-button" aria-label="Закрыть панель профиля" onClick={close}><X size={17} /></button><h2>{profile.name}</h2><div className="detail-status"><Status status={state} /><span className="muted mono">{profile.id.slice(0, 8)}</span></div></header>
    <div className="detail-tabs" role="tablist" aria-label="Разделы профиля">{[['overview', 'Обзор'], ['cookies', 'Cookies'], ['settings', 'Настройки']].map(([id, label]) => <button role="tab" aria-selected={tab === id} key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    <div className="detail-body" role="tabpanel">
      {tab === 'cookies' ? <CookiesPanel key={profile.id} profile={profile} stopped={stopped} /> : tab === 'overview' ? <div className="detail-overview">
        {snapshot.runtime[profile.id]?.error && <div className="error-box" role="alert">{snapshot.runtime[profile.id].error}</div>}
        <button className={`button ${stopped ? 'primary' : 'secondary'} full-width`} disabled={state === 'stopping'} onClick={stopped ? launch : stop}>{stopped ? <Play size={16} /> : <Square size={14} />}{stopped ? 'Запустить профиль' : 'Остановить профиль'}</button>
        <section className="detail-section"><h3><Globe2 size={15} />Подключение</h3><div className="detail-info"><span>Прокси</span><strong>{proxy?.name ?? 'Прямое подключение'}</strong></div>{proxy && <p className="form-hint">{proxy.protocol.toUpperCase()} · {proxy.host}:{proxy.port}</p>}<div className="detail-info"><span>Стартовая страница</span></div><p className="start-url"><ExternalLink size={13} />{profile.startUrl}</p></section>
        <section className="detail-section"><h3><Tag size={15} />Теги</h3><div className="detail-tags">{profile.tags.length ? profile.tags.map(tag => <span key={tag} className="tag">{tag}</span>) : <span className="muted">Теги не добавлены</span>}</div></section>
        <section className="detail-section"><h3>Заметка</h3><p className={`detail-note ${profile.notes ? '' : 'muted'}`}>{profile.notes || 'Добавьте заметку в настройках профиля.'}</p></section>
        <section className="detail-section"><h3><Clock3 size={15} />Последний запуск</h3><p className="muted">{profile.lastOpenedAt ? new Date(profile.lastOpenedAt).toLocaleString('ru') : 'Ещё не запускался'}</p></section>
        <button className="button secondary full-width" disabled={!stopped} onClick={edit}><Pencil size={15} />Изменить профиль</button>
      </div> : <div className="detail-overview"><h3>Настройки профиля</h3><p className="muted">Имя, адрес, прокси, теги и параметры сохранения сессии.</p><button className="button secondary full-width" onClick={edit} disabled={!stopped}><Pencil size={16} />Редактировать</button><div className="detail-section"><h3>Session cookies</h3><p>{profile.restoreSessionCookies ? 'Восстанавливаются после закрытия' : 'Удаляются при закрытии профиля'}</p><p className="form-hint">Постоянные cookies и хранилища сайтов сохраняются в обоих режимах.</p></div><div className="detail-section"><h3>Копирование</h3><p className="form-hint">Создаёт профиль с теми же настройками и cookies. Local Storage и файлы сайтов не переносятся.</p><button className="button secondary full-width" disabled={!stopped} onClick={duplicate}><Copy size={15} />Копировать настройки и cookies</button></div><div className="detail-section"><h3>Удаление</h3><p className="form-hint">Удаляет профиль и его локальную сессию после подтверждения.</p><button className="button danger-button full-width" disabled={!stopped} onClick={remove}><Trash2 size={15} />Удалить профиль</button></div></div>}
    </div>
  </aside>;
}
