export function text(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Error(`${label}: укажите от 1 до ${max} символов.`);
  return value.trim();
}
export function webUrl(value: unknown): string {
  const input = text(value, 'Адрес', 4096);
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Укажите полный адрес сайта: https://example.com'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Разрешены только HTTP(S)-адреса без пароля в ссылке.');
  return url.href;
}
export function hostName(value: unknown): string {
  const host = text(value, 'Сервер', 253);
  if (!/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?|\[[a-fA-F0-9:]+\])$/.test(host)) throw new Error('Сервер: укажите домен или IP без протокола, пути и порта.');
  return host.toLowerCase();
}
export function integer(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`${label}: число от ${min} до ${max}.`);
  return value;
}
export function tags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 30 || value.some(v => typeof v !== 'string' || v.length > 40)) throw new Error('Укажите до 30 тегов, не длиннее 40 символов каждый.');
  return [...new Set(value.map(v => v.trim()).filter(Boolean))];
}
