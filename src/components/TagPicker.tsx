import { useId } from 'react';
import { Check, Plus } from 'lucide-react';

export function TagPicker({ value, onChange, existing, bulk = false }: {
  value: string; onChange: (value: string) => void; existing: string[]; bulk?: boolean;
}) {
  const hint = useId();
  const selected = new Set(value.split(',').map(tag => tag.trim()).filter(Boolean));
  function toggle(tag: string) {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    onChange([...next].join(', '));
  }
  return <div className="tag-picker">
    <label>{bulk ? 'Новые теги через запятую' : 'Теги через запятую'}
      <input value={value} onChange={event => onChange(event.target.value)} placeholder={bulk ? 'Пусто — оставить текущие теги' : 'Добавить свои теги'} aria-describedby={hint} />
    </label>
    {existing.length > 0 && <div className="tag-options" role="group" aria-label="Существующие теги">
      <span className="tag-options-label">Существующие теги</span>
      <div className="tag-options-buttons">{existing.map(tag => <button type="button" key={tag} className="tag-option" aria-pressed={selected.has(tag)} onClick={() => toggle(tag)}>
        {selected.has(tag) ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}{tag}
      </button>)}</div>
    </div>}
    <p className="form-hint" id={hint}>{bulk ? 'Указанные теги заменят текущие у выбранных профилей' : existing.length ? 'Нажмите на тег, чтобы добавить или убрать его' : 'Новые теги появятся здесь после сохранения профиля'}</p>
  </div>;
}
