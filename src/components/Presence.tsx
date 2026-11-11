import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Keep an exiting overlay alive briefly; never delay the underlying operation. */
export function Presence({ present, children }: { present: boolean; children: ReactNode }) {
  const [retained, setRetained] = useState(present);
  const previous = useRef(children);
  const container = useRef<HTMLDivElement>(null);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  useLayoutEffect(() => {
    if (present) { previous.current = children; setRetained(true); }
  }, [present, children]);
  useLayoutEffect(() => {
    container.current?.querySelectorAll('dialog').forEach(dialog => { dialog.inert = !present; });
    if (present) return;
    const timer = setTimeout(() => setRetained(false), reduced ? 0 : 160);
    return () => clearTimeout(timer);
  }, [present, reduced]);
  if (!present && (!retained || reduced)) return null;
  return <div ref={container} className="presence" data-state={present ? 'open' : 'closing'} inert={!present}>
    {present ? children : previous.current}
  </div>;
}
