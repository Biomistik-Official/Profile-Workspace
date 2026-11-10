import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, onClose, children, wide = false, panel = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; panel?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog className={`modal ${wide ? 'modal-wide' : ''} ${panel ? 'modal-panel' : ''}`} ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="modal-head"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Закрыть окно"><X size={19} /></button></header>
    {children}
  </dialog>;
}
