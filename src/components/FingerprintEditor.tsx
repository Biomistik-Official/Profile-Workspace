import { Fingerprint as FingerprintIcon, RefreshCw } from 'lucide-react';
import type { Fingerprint } from '../../shared/types';
export function FingerprintEditor({ value, change, regenerate, busy }: { value: Fingerprint; change: (value: Fingerprint) => void; regenerate: () => void; busy: boolean }) {
  function patch(input: Partial<Fingerprint>) { change({ ...value, ...input }); }
  return <fieldset className="fingerprint-editor"><legend><FingerprintIcon size={17} />Отпечаток</legend>
    <p className="form-hint">Параметры сохраняются за профилем. Новый набор не удаляет cookies и сессии.</p>
    <div className="form-grid"><label>Язык браузера<input value={value.language} onChange={e => patch({ language: e.target.value })} placeholder="en-GB" required maxLength={40} /></label>
      <label>Часовой пояс<input value={value.timezone} onChange={e => patch({ timezone: e.target.value })} placeholder="Europe/London" required maxLength={100} list="fingerprint-timezones" /></label></div>
    <datalist id="fingerprint-timezones">{['Europe/London','Europe/Amsterdam','Europe/Berlin','Europe/Stockholm','Europe/Paris','Europe/Moscow','America/New_York','America/Los_Angeles','America/Toronto','Asia/Tokyo'].map(t => <option value={t} key={t} />)}</datalist>
    <div className="form-grid"><label>Ширина экрана<input type="number" min={640} max={7680} required value={value.screenWidth} onChange={e => patch({ screenWidth: Number(e.target.value) })} /></label>
      <label>Высота экрана<input type="number" min={480} max={4320} required value={value.screenHeight} onChange={e => patch({ screenHeight: Number(e.target.value) })} /></label></div>
    <label>Логических ядер<input type="number" min={1} max={64} required value={value.hardwareConcurrency} onChange={e => patch({ hardwareConcurrency: Number(e.target.value) })} /></label>
    <label>User-Agent<input maxLength={512} value={value.userAgent} onChange={e => patch({ userAgent: e.target.value })} placeholder="Автоматически · текущая версия Chromium" /></label>
    <p className="form-hint">Пустой User-Agent использует версию установленного Chromium. Свой адрес прокси выбирается отдельно; язык и часовой пояс подбирайте с учётом его региона.</p>
    <button type="button" className="button secondary" disabled={busy} onClick={regenerate}><RefreshCw size={16} />{busy ? 'Генерация…' : 'Сгенерировать новый'}</button>
    <p className="form-hint">Canvas, WebGL, Audio, шрифты и параметры workers остаются системными. Эти настройки не гарантируют уникальность браузера или снятие блокировок сайтов.</p>
  </fieldset>;
}
