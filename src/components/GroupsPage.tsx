import { useState, type FormEvent } from 'react';
import { FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Presence } from './Presence';

export function GroupsPage({ groups, open }: { groups: [string, number][]; open: (name: string) => void }) {
  const [editor, setEditor] = useState<{ previousName?: string } | null>(null);
  const [name, setName] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  function edit(previousName?: string) { setError(''); setName(previousName ?? ''); setEditor({ previousName }); }
  async function submit(e: FormEvent) {
    e.preventDefault(); setSaving(true); setError('');
    try { await window.workspace.saveGroup({ name, previousName: editor?.previousName }); setEditor(null); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  async function remove() {
    if (removing === null) return;
    setSaving(true); setError('');
    try { await window.workspace.deleteGroup(removing); setRemoving(null); }
    catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  }
  return <>
    <header className="page-header"><div><h1>Группы</h1><p>Создавайте группы заранее и назначайте их профилям.</p></div><button className="button primary" onClick={() => edit()}><Plus size={18} />Новая группа</button></header>
    <p className="page-notice">Пустые группы сохраняются, даже если убрать их со всех профилей.</p>
    {!groups.length ? <section className="empty-workspace"><FolderOpen size={40} strokeWidth={1.4} /><h2>Создайте первую группу</h2><p>Профили можно добавить позже через их настройки.</p><button className="button secondary" onClick={() => edit()}>Создать группу</button></section> : <div className="proxy-list">{groups.map(([name, count]) => <article className="proxy-card group-card" key={name}>
      <div className="proxy-card-icon"><FolderOpen size={21} /></div><div className="proxy-card-info"><h2>{name}</h2><p>{count} профилей</p></div>
      <div className="proxy-card-actions"><button className="button secondary compact" onClick={() => open(name)}>Открыть профили</button><button className="icon-button" aria-label={`Переименовать группу ${name}`} onClick={() => edit(name)}><Pencil size={16} /></button><button className="icon-button danger" aria-label={`Удалить группу ${name}`} onClick={() => { setError(''); setRemoving(name); }}><Trash2 size={16} /></button></div>
    </article>)}</div>}
    <Presence present={!!editor}>{editor && <Modal title={editor.previousName === undefined ? 'Новая группа' : 'Переименовать группу'} onClose={() => { if (!saving) setEditor(null); }}><form className="form-body" onSubmit={submit}><label>Название группы<input autoFocus required maxLength={40} value={name} onChange={e => setName(e.target.value)} /></label><p className="form-hint">До 40 символов, без запятых. При переименовании название изменится во всех профилях.</p>{error && <div className="error-box" role="alert">{error}</div>}<footer className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={() => setEditor(null)}>Отмена</button><button className="button primary" disabled={saving}>{saving ? 'Сохранение…' : editor.previousName === undefined ? 'Создать группу' : 'Сохранить группу'}</button></footer></form></Modal>}</Presence>
    <Presence present={removing !== null}>{removing !== null && <Modal title="Удалить группу?" onClose={() => { if (!saving) setRemoving(null); }}><div className="form-body"><p>Группа «{removing}» будет удалена и снята со всех профилей. Сами профили и их данные сохранятся.</p>{error && <div className="error-box" role="alert">{error}</div>}<footer className="modal-actions"><button className="button secondary" disabled={saving} onClick={() => setRemoving(null)}>Отмена</button><button className="button primary" disabled={saving} onClick={() => void remove()}>{saving ? 'Удаление…' : 'Удалить группу'}</button></footer></div></Modal>}</Presence>
  </>;
}
