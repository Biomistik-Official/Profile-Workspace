import { useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import type { UpdateState } from '../../shared/types';

export function UpdatesCard({ state = { status: 'disabled' }, notify }: { state?: UpdateState; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const messages = {
    disabled: 'Автообновление доступно в установленной Windows-версии. В портативной и тестовой сборке оно отключено.',
    idle: 'Проверяем обновления при запуске и каждые 6 часов. Новые версии скачиваются автоматически.',
    checking: 'Проверяем новую версию…',
    downloading: `Скачиваем версию ${state.version ?? ''}: ${state.percent ?? 0}%`,
    ready: `Версия ${state.version ?? ''} готова. Обновление установится после закрытия приложения и сохранения сессий.`,
    error: 'Не удалось проверить или скачать обновление. Приложение продолжает работать; попробуйте позже.',
  };
  async function act() {
    setBusy(true);
    try { if (state.status === 'ready') await window.workspace.closeToUpdate(); else await window.workspace.checkUpdates(); }
    catch (e) { notify((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="settings-card"><div className="settings-heading"><Download size={21} /><div><h2>Обновления приложения</h2><p>Новые версии из GitHub Releases.</p></div></div>
    <p role="status">{messages[state.status]}</p>
    {state.status === 'downloading' && <progress aria-label="Загрузка обновления" value={state.percent ?? 0} max={100} />}
    <div><button className="button secondary" disabled={busy || ['disabled', 'checking', 'downloading'].includes(state.status)} onClick={() => void act()}><RefreshCw size={16} />{state.status === 'ready' ? 'Закрыть и обновить' : 'Проверить обновления'}</button></div>
    <p className="form-hint">Открытые профили автоматически не перезапускаются. Профили, cookies и настройки остаются в вашей папке данных.</p>
  </section>;
}
