import { flushSync } from 'react-dom';

let active: ViewTransition | undefined;
let revision = 0;

/** Commit immediately without motion, or crossfade the changed region. Last input wins. */
export function transitionView(update: () => void, afterUpdate?: () => void): void {
  const current = ++revision;
  active?.skipTransition();
  if (!document.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    flushSync(update);
    afterUpdate?.();
    return;
  }
  const transition = document.startViewTransition(() => {
    if (revision === current) { flushSync(update); afterUpdate?.(); }
  });
  active = transition;
  void transition.finished.catch(() => {}).finally(() => { if (active === transition) active = undefined; });
}
