import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
export function Modal({ title, onClose, children, wide = false, panel = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; panel?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null); const id = useId();
  const returnFocus = useRef(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  useEffect(() => {
    const dialog = ref.current!; dialog.showModal();
    return () => {
      dialog.close();
      queueMicrotask(() => {
        if (returnFocus.current?.isConnected && !document.querySelector('dialog[open]')) returnFocus.current.focus({ preventScroll: true });
      });
    };
  }, []);
  return <dialog className={`modal ${wide ? 'modal-wide' : ''} ${panel ? 'modal-panel' : ''}`} ref={ref} aria-labelledby={id} onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="modal-head"><h2 id={id}>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Закрыть окно"><X size={19} /></button></header>
    {children}
  </dialog>;
}
