import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { Camoufox, launchOptions } from 'camoufox';
import { fileURLToPath } from 'node:url';
import { runtimeExecutable, runtimeStatus, installRuntime, syncPolicies } from './native-runtime.mjs';

import { camouConfigBlob } from 'camoufox/dist/utils.js';

const contexts = new Map();
const tails = new Map();
const send = message => process.parentPort ? process.parentPort.postMessage(message) : process.send?.(message);
function portable(cookie) {
  return { domain: cookie.domain, name: cookie.name, value: cookie.value, path: cookie.path,
    secure: cookie.secure, httpOnly: cookie.httpOnly, hostOnly: !cookie.domain.startsWith('.'),
    sameSite: cookie.sameSite === 'None' && !cookie.secure ? 'unspecified' : ({ Strict: 'strict', Lax: 'lax', None: 'no_restriction' })[cookie.sameSite] ?? 'unspecified',
    ...(cookie.expires > 0 ? { expirationDate: cookie.expires } : {}) };
}
function nativeCookie(cookie) {
  return { domain: cookie.hostOnly ? cookie.domain.replace(/^\./, '') : cookie.domain, path: cookie.path,
    name: cookie.name, value: cookie.value, secure: cookie.secure, httpOnly: cookie.httpOnly,
    sameSite: ({ strict: 'Strict', lax: 'Lax', no_restriction: 'None', unspecified: 'Lax' })[cookie.sameSite],
    expires: cookie.expirationDate ?? -1 };
}
async function capture(entry, notify = false, force = false) {
  if (entry.closing && !force) return entry.cookies;
  try {
    const cookies = (await entry.context.cookies()).map(portable);
    if (entry.closed || entry.closing && !force) return entry.cookies;
    entry.cookies = cookies;
    const serialized = JSON.stringify(entry.cookies);
    if (notify && entry.serialized !== serialized) {
      entry.serialized = serialized; send({ event: 'cookies', id: entry.id, cookies: entry.cookies });
    }
  } catch { /* Native window may already be closing; persistent Firefox data remains on disk. */ }
  return entry.cookies;
}
async function openContext(args, headless) {
  const { profile, root, sessionCookies = [], proxy } = args;
  if (!/^[a-f0-9-]{36}$/.test(profile.id) || profile.engine !== 'camoufox') throw new Error('Invalid profile');
  // Missing engines are a visible setup action, never an implicit direct/Chromium fallback.
  if (runtimeStatus().status !== 'ready') throw new Error('Engine not installed');
  await syncPolicies(args.sites ?? []);
  const base = join(root, 'camoufox', profile.id);
  await mkdir(base, { recursive: true });
  const identityPath = join(base, 'identity.json');
  let identity;
  try { identity = JSON.parse(await readFile(identityPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const settings = profile.nativeSettings ?? { locale: 'en-US', timezone: 'Europe/London' };
  const config = { ...(identity?.config ?? {}), timezone: settings.timezone };
  const chrome = join(base, 'browser', 'chrome'); await mkdir(chrome, { recursive: true });
  const chromeCSS = await readFile(fileURLToPath(new URL('../../assets/firefox-userChrome.css', import.meta.url)), 'utf8');
  await writeFile(join(chrome, 'userChrome.css'), chromeCSS + `\n#TabsToolbar::before { content: ${JSON.stringify(profile.name)}; display: flex; align-items: center; padding: 0 12px; color: #ffc799; max-width: 200px; overflow: hidden; font-size: 12px; }`);
  // Locale-related native values must follow deliberate edits, not the old saved locale.
  for (const key of Object.keys(config)) if (key.startsWith('locale:') || key === 'navigator.language' || key === 'headers.Accept-Language') delete config[key];
  const options = await launchOptions({ executable_path: runtimeExecutable, os: 'windows', headless: false, locale: settings.locale,
    config, block_webrtc: true, enable_cache: true, exclude_addons: ['UBO'], window: [1180, 760],
    // A hidden cookie operation must not initiate background direct network requests.
    proxy: proxy ?? (headless ? { server: 'http://127.0.0.1:1' } : undefined),
    firefox_user_prefs: {
      'network.proxy.no_proxies_on': '', 'network.proxy.allow_hijacking_localhost': true,
      'network.proxy.failover_direct': false, 'network.proxy.socks_remote_dns': true,
      'network.trr.mode': 5, 'network.dns.disablePrefetch': true, 'network.prefetch-next': false,
      'network.predictor.enabled': false, 'network.http.http3.enable': false, 'browser.startup.page': 0,
      'browser.sessionstore.resume_from_crash': false, 'browser.sessionstore.resume_session_once': false,
      'ui.systemUsesDarkTheme': 1, 'browser.theme.toolbar-theme': 0, 'browser.theme.content-theme': 0,
      'toolkit.legacyUserProfileCustomizations.stylesheets': true, 'permissions.default.geo': 2,
      'permissions.default.camera': 2, 'permissions.default.microphone': 2,
      'permissions.default.desktop-notification': 2,
    } });
  const actualConfig = JSON.parse(camouConfigBlob(options));
  // Persist only native identity values, never the process environment or proxy credentials.
  await writeFile(`${identityPath}.tmp`, JSON.stringify({ version: 1, config: actualConfig }, null, 2), { mode: 0o600 });
  await rename(`${identityPath}.tmp`, identityPath);
  const context = await Camoufox({ persistent_context: true, from_options: { ...options, headless, colorScheme: 'dark', user_data_dir: join(base, 'browser'), viewport: null } });
  try { if (sessionCookies.length) await context.addCookies(sessionCookies.map(nativeCookie)); }
  catch (error) { await context.close(); throw error; }
  return { context, id: profile.id, cookies: [], timer: undefined, serialized: '' };
}
async function operation(command, args) {
  if (command === 'status') return runtimeStatus();
  if (command === 'install') return installRuntime(args.sites ?? []);
  if (command === 'syncSites') { await syncPolicies(args.sites ?? []); return; }
  const id = args.profile.id;
  if (command === 'start') {
    if (contexts.has(id)) { await contexts.get(id).context.pages()[0]?.bringToFront(); return; }
    const entry = await openContext(args, false); contexts.set(id, entry);
    entry.context.on('close', () => {
      entry.closed = true; clearInterval(entry.timer); contexts.delete(id);
      send({ event: 'closed', id, cookies: entry.cookies });
    });
    entry.timer = setInterval(() => void capture(entry, true), 1000);
    const observe = page => { page.on('response', () => void capture(entry, true)); page.on('requestfinished', () => void capture(entry, true)); page.on('close', () => void capture(entry, true)); };
    entry.context.on('page', observe);
    for (const page of entry.context.pages()) observe(page);
    const page = entry.context.pages()[0] ?? await entry.context.newPage();
    try { await page.goto(args.profile.startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }); }
    catch { /* Keep the browser and its native error page usable. Assigned proxy policy remains in force. */ }
    await capture(entry, true); return;
  }
  if (command === 'focus') { await contexts.get(id)?.context.pages()[0]?.bringToFront(); return; }
  if (command === 'stop') {
    const entry = contexts.get(id); if (!entry) return [];
    entry.closing = true; clearInterval(entry.timer);
    const cookies = await capture(entry, false, true);
    if (!args.profile.restoreSessionCookies) for (const cookie of cookies.filter(c => !c.expirationDate)) await entry.context.clearCookies({ name: cookie.name, domain: cookie.domain, path: cookie.path });
    await entry.context.close(); return cookies;
  }
  const running = contexts.get(id);
  const entry = running ?? await openContext(args, true);
  try {
    if (command === 'cookies') return await capture(entry);
    if (command === 'import' || command === 'clear') {
      const original = await entry.context.cookies();
      try {
        if (command === 'clear' || args.mode === 'replace') await entry.context.clearCookies();
        if (command === 'import' && args.cookies.length) await entry.context.addCookies(args.cookies.map(nativeCookie));
      } catch (error) {
        await entry.context.clearCookies(); await entry.context.addCookies(original); throw error;
      }
      return await capture(entry);
    }
    throw new Error('Unsupported operation');
  } finally { if (!running) await entry.context.close(); }
}
function receive(message) {
  const { requestId, command, args } = message;
  const key = args?.profile?.id ?? '_engine';
  const task = (tails.get(key) ?? Promise.resolve()).then(() => operation(command, args));
  tails.set(key, task.catch(() => {}));
  void task.then(result => send({ requestId, result }), () => send({ requestId,
    error: command === 'install' ? 'Не удалось установить Camoufox. Проверьте соединение и повторите установку.' :
      command === 'status' ? 'Не удалось проверить движок.' : 'Camoufox: операция не выполнена. Проверьте установку движка, параметры профиля и прокси.' }));
}
if (process.parentPort) process.parentPort.on('message', event => receive(event.data));
else process.on('message', receive);
