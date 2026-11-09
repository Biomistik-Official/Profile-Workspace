import { _electron as electron, expect, test } from '@playwright/test';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('OAuth popup preserves opener and session storage, exchanges messages and closes safely', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-oauth-'));
  let origin = ''; let providerOrigin = '';
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    if (req.url === '/callback') res.end(`<script>
      window.addEventListener('message', e => { if(e.origin === location.origin && e.data === 'accepted') window.close(); });
      if(window.opener) window.opener.postMessage({state:sessionStorage.getItem('oauth-state'), isolated:typeof window.workspace === 'undefined' && typeof window.require === 'undefined', cookie:document.cookie.includes('profile-session=synthetic')},location.origin);
    </script>`);
    else res.end(`<button id="connect">Connect</button><script>
      sessionStorage.setItem('oauth-state','synthetic-state');
      document.cookie='profile-session=synthetic; Path=/';
      document.querySelector('#connect').onclick=()=>window.open('${providerOrigin}/provider','oauth');
      window.addEventListener('message',e=>{if(e.origin===location.origin && e.data.state==='synthetic-state' && e.data.isolated && e.data.cookie){document.title='OAuth completed';e.source.postMessage('accepted',e.origin);}});
    </script>`);
  });
  const provider = createServer((_req, res) => { res.writeHead(302, { Location: origin + '/callback' }); res.end(); });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  await new Promise<void>(r => provider.listen(0, '127.0.0.1', r));
  origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  providerOrigin = `http://127.0.0.1:${(provider.address() as { port: number }).port}`;
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const app = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    await app.evaluate(({ dialog }) => {
      (globalThis as any).__oauthErrors = [];
      dialog.showErrorBox = (title, message) => { (globalThis as any).__oauthErrors.push({ title, message }); };
    });
    const manager = await app.firstWindow();
    await manager.evaluate(async url => {
      await window.workspace.saveProfile({ name: 'OAuth', startUrl: url });
      await window.workspace.launch([(await window.workspace.snapshot()).profiles[0].id]);
    }, origin + '/start');
    await expect.poll(() => manager.evaluate(async () => {
      const s = await window.workspace.snapshot(); const state = s.runtime[s.profiles[0].id]; return state?.error ?? state?.status;
    })).toBe('running');
    await expect.poll(() => app.windows().some(w => w.url() === origin + '/start')).toBe(true);
    const parent = app.windows().find(w => w.url() === origin + '/start')!;
    await parent.locator('#connect').click();
    await expect(parent).toHaveTitle('OAuth completed');
    const shell = app.windows().find(w => w.url().includes('mode=browser'))!;
    await expect.poll(() => shell.evaluate(async () => (await window.browser.state()).tabs.length)).toBe(1);
    expect(await parent.evaluate(() => window.open('file:///C:/Windows') === null)).toBe(true);
    expect(await app.evaluate(() => (globalThis as any).__oauthErrors)).toEqual([]);
  } finally {
    await app.close(); await Promise.all([new Promise<void>(r => server.close(() => r())), new Promise<void>(r => provider.close(() => r()))]);
    await rm(data, { recursive: true, force: true });
  }
});
