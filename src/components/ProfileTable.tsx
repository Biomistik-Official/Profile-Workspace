import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Play, Square, MoreHorizontal, ArrowUpDown } from 'lucide-react';
import type { Profile, ProfileStatus, WorkspaceSnapshot } from '../../shared/types';
export const statusNames: Record<ProfileStatus, string> = { stopped: 'Остановлен', queued: 'В очереди', starting: 'Запускается', running: 'Работает', stopping: 'Останавливается', error: 'Ошибка' };
export function Status({ status = 'stopped' }: { status?: ProfileStatus }) { return <span className={`status status-${status}`}><span className="status-dot" />{statusNames[status]}</span>; }
export function ProfileTable({ profiles, snapshot, selected, activeId, toggle, toggleAll, open, edit, launch, stop, sort }: {
  profiles: Profile[]; snapshot: WorkspaceSnapshot; selected: Set<string>; activeId: string | null;
  toggle: (id: string) => void; toggleAll: () => void; open: (id: string) => void; edit: (p: Profile) => void;
  launch: (id: string) => void; stop: (id: string) => void; sort: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const virtual = useVirtualizer({ count: profiles.length, getScrollElement: () => ref.current, estimateSize: () => 76, overscan: 8, getItemKey: index => profiles[index].id });
  const all = profiles.length > 0 && profiles.every(p => selected.has(p.id));
  return <div className="profile-table" role="table" aria-label="Профили браузера" aria-rowcount={profiles.length + 1}>
    <div className="table-header profile-grid" role="row"><span role="columnheader"><input type="checkbox" aria-label="Выбрать все показанные профили" checked={all} onChange={toggleAll} /></span><span role="columnheader"><button className="column-sort" onClick={sort}>Профиль<ArrowUpDown size={12} /></button></span><span role="columnheader">Статус</span><span role="columnheader" className="proxy-column">Прокси</span><span role="columnheader" className="tag-column">Теги</span><span role="columnheader" className="sr-only">Действия</span></div>
    <div className="table-scroll" ref={ref}><div style={{ height: virtual.getTotalSize(), position: 'relative', minWidth: '100%' }}>
      {virtual.getVirtualItems().map(item => {
        const p = profiles[item.index]; const status = snapshot.runtime[p.id]?.status ?? 'stopped'; const proxy = snapshot.proxies.find(proxy => proxy.id === p.proxyId);
        const running = ['running', 'starting', 'queued'].includes(status);
        return <div key={p.id} className={`profile-row profile-grid ${activeId === p.id ? 'active' : ''} ${selected.has(p.id) ? 'checked' : ''}`} role="row" aria-rowindex={item.index + 2} style={{ height: item.size, position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${item.start}px)` }}>
          <span role="cell"><input type="checkbox" aria-label={`Выбрать ${p.name}`} checked={selected.has(p.id)} onChange={() => toggle(p.id)} /></span>
          <span role="cell" className="profile-name-cell"><button className="profile-name" aria-label={`Открыть профиль ${p.name}`} onClick={() => open(p.id)}><strong>{p.name}</strong><span>{snapshot.runtime[p.id]?.error || p.notes || 'Без заметки'}</span></button></span>
          <span role="cell"><Status status={status} /></span>
          <span role="cell" className="proxy-column proxy-cell" title={proxy ? `${proxy.protocol}://${proxy.host}:${proxy.port}` : 'Прямое подключение'}>{proxy?.name ?? 'Без прокси'}</span>
          <span role="cell" className="tag-column"><span className="row-tags">{p.tags.slice(0, 1).map(tag => <span className="tag" key={tag}>{tag}</span>)}{p.tags.length > 1 && <span className="tag-overflow">+{p.tags.length - 1}</span>}</span></span>
          <span role="cell" className="row-actions"><button className={`icon-button ${running ? '' : 'launch-button'}`} disabled={status === 'stopping'} aria-label={`${running ? 'Остановить' : 'Запустить'} ${p.name}`} title={running ? 'Остановить' : 'Запустить'} onClick={() => running ? stop(p.id) : launch(p.id)}>{running ? <Square size={13} fill="currentColor" /> : <Play size={15} fill="currentColor" />}</button><button className="icon-button row-edit" aria-label={`Настройки ${p.name}`} disabled={running || status === 'stopping'} onClick={() => edit(p)}><MoreHorizontal size={16} /></button></span>
        </div>;
      })}
    </div></div>
  </div>;
}
