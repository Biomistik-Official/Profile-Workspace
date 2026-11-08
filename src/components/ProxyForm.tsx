import { useState, type FormEvent } from 'react';
import type { ProxyDraft, ProxyInfo, ProxyProtocol } from '../../shared/types';
import { Modal } from './Modal';
export function ProxyForm({ proxy, save, close }: { proxy?: ProxyInfo; save: (draft: ProxyDraft) => Promise<void>; close: () => void }) {
  const [name, setName] = useState(proxy?.name ?? ''); const [protocol, setProtocol] = useState<ProxyProtocol>(proxy?.protocol ?? 'http');
  const [host, setHost] = useState(proxy?.host ?? ''); const [port, setPort] = useState(String(proxy?.port ?? ''));
  const [username, setUsername] = useState(proxy?.username ?? ''); const [password, setPassword] = useState(''); const [clear, setClear] = useState(false);
  const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) { e.preventDefault(); setSaving(true); try { await save({ id: proxy?.id, name, protocol, host, port: Number(port), username, password: password || undefined, clearPassword: clear }); close(); } catch (e) { setError((e as Error).message); } finally { setSaving(false); } }
  return <Modal title={proxy ? 'Настройки прокси' : 'Новый прокси'} onClose={close}><form className="form-body" onSubmit={submit}>
    <label>Название прокси<input autoFocus required value={name} onChange={e => setName(e.target.value)} placeholder="Например, UK · London" /></label>
    <div className="form-grid"><label>Протокол<select value={protocol} onChange={e => setProtocol(e.target.value as ProxyProtocol)}><option value="http">HTTP</option><option value="https">HTTPS</option><option value="socks5">SOCKS5</option></select></label><label>Порт<input type="number" min="1" max="65535" required value={port} onChange={e => setPort(e.target.value)} placeholder="8080" /></label></div>
    <label>Сервер<input required value={host} onChange={e => setHost(e.target.value)} placeholder="proxy.example.com или 127.0.0.1" /></label>
    <div className="form-grid"><label>Логин<input autoComplete="off" value={username} onChange={e => setUsername(e.target.value)} /></label><label>Пароль<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} placeholder={proxy?.hasPassword ? 'Сохранён · пусто = оставить' : 'Необязательно'} /></label></div>
    {proxy?.hasPassword && <label className="check-label"><input type="checkbox" checked={clear} onChange={e => setClear(e.target.checked)} /><span>Удалить сохранённый пароль</span></label>}
    <p className="form-hint">Пароль шифруется средствами Windows. SOCKS5 с авторизацией пока не поддерживается. При недоступном прокси профиль не выходит в сеть напрямую.</p>
    {error && <div className="error-box" role="alert">{error}</div>}
    <footer className="modal-actions"><button type="button" className="button secondary" onClick={close}>Отмена</button><button className="button primary" disabled={saving}>{saving ? 'Сохранение…' : 'Сохранить прокси'}</button></footer>
  </form></Modal>;
}
