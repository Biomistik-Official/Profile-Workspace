import { BrowserWindow, dialog, Menu, WebContentsView, type Session, type WebPreferences, type WebContentsViewConstructorOptions } from 'electron';
import { join } from 'node:path';
import type { BrowserState, Profile } from '../shared/types';
import { webUrl } from '../core/validation';

export class ProfileBrowser {
  readonly window: BrowserWindow;
  private tabs = new Map<number, WebContentsView>();
  private activeId = 0;
  private sitesOpen = false;
  private shutting = false;
  private closing?: Promise<void>;
  constructor(readonly profile: Profile, readonly session: Session, private renderer: string, private beforeClose: () => Promise<void>, private afterClose: () => void) {
    this.window = new BrowserWindow({ title: profile.name, width: 1280, height: 850, minWidth: 720, minHeight: 500, backgroundColor: '#101010', autoHideMenuBar: true,
      icon: join(__dirname, '../../assets/icon.png'),
      webPreferences: { preload: join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, partition: 'persist:workspace-ui' } });
    this.window.webContents.on('will-navigate', e => e.preventDefault());
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.on('resize', () => this.layout());
    this.window.on('close', e => { if (!this.shutting) { e.preventDefault(); void this.close().catch(() => dialog.showErrorBox('Не удалось сохранить сессию', 'Приложение остаётся открытым. Cookies доступны в панели профиля: экспортируйте их или повторите закрытие приложения после устранения ошибки сохранения.')); } });
    this.window.on('closed', () => { this.afterClose(); });
    this.window.webContents.on('did-finish-load', () => this.publish());
  }
  async open(): Promise<void> {
    await this.window.loadFile(this.renderer, { query: { mode: 'browser' } });
    await this.addTab(this.profile.startUrl);
  }
  state(): BrowserState {
    this.pruneDestroyedTabs();
    const active = this.tabs.get(this.activeId)?.webContents;
    return { profileName: this.profile.name, activeId: this.activeId,
      tabs: [...this.tabs].map(([id, view]) => ({ id, title: view.webContents.getTitle() || 'Новая вкладка', url: view.webContents.getURL(), loading: view.webContents.isLoading() })),
      canGoBack: active?.navigationHistory.canGoBack() ?? false, canGoForward: active?.navigationHistory.canGoForward() ?? false };
  }
  private pruneDestroyedTabs(): void {
    for (const [id, view] of this.tabs) {
      const wc = view.webContents;
      if (!wc || wc.isDestroyed()) {
        this.tabs.delete(id);
        if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
      }
    }
    if (!this.tabs.has(this.activeId)) this.activeId = [...this.tabs.keys()].at(-1) ?? 0;
  }
  private publish(): void { if (!this.window.isDestroyed()) this.window.webContents.send('browser:changed', this.state()); }
  setSitesOpen(open: boolean): void { this.sitesOpen = open; this.layout(); }
  private layout(): void {
    if (this.window.isDestroyed()) return;
    this.pruneDestroyedTabs();
    const [width, height] = this.window.getContentSize();
    for (const [id, view] of this.tabs) { view.setVisible(id === this.activeId); view.setBounds({ x: this.sitesOpen ? 300 : 0, y: 98, width: Math.max(0, width - (this.sitesOpen ? 300 : 0)), height: Math.max(0, height - 98) }); }
  }
  async addTab(url = 'https://duckduckgo.com/'): Promise<void> {
    const address = webUrl(url);
    if (this.closing || this.window.isDestroyed()) return;
    const view = this.createTab();
    try { await view.webContents.loadURL(address); } catch { /* Chromium displays its own network error; keep the address bar usable. */ }
    this.publish();
  }
  private remotePreferences(inherited: WebPreferences = {}): WebPreferences {
    return { ...inherited, session: this.session, preload: undefined,
      contextIsolation: true, nodeIntegration: false, nodeIntegrationInSubFrames: false, nodeIntegrationInWorker: false,
      sandbox: true, webSecurity: true, allowRunningInsecureContent: false };
  }
  private createTab(options: WebContentsViewConstructorOptions = {}): WebContentsView {
    const view = new WebContentsView({ ...(options.webContents ? { webContents: options.webContents } : {}),
      webPreferences: this.remotePreferences(options.webPreferences) });
    this.tabs.set(view.webContents.id, view); this.activeId = view.webContents.id;
    this.window.contentView.addChildView(view);
    const wc = view.webContents;
    wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
    wc.setWindowOpenHandler(({ url }) => {
      if (this.closing || this.window.isDestroyed()) return { action: 'deny' };
      try { if (url !== 'about:blank') webUrl(url); } catch { return { action: 'deny' }; }
      // Let Chromium create the opener relationship, clone sessionStorage and
      // forward POST/referrer data; display the child as a sandboxed profile tab.
      return { action: 'allow', overrideBrowserWindowOptions: { webPreferences: this.remotePreferences() },
        createWindow: options => this.createTab(options).webContents };
    });
    wc.on('will-navigate', (event, url) => { if (!/^https?:\/\//i.test(url)) event.preventDefault(); });
    wc.on('will-redirect', (event, url) => { if (!/^https?:\/\//i.test(url)) event.preventDefault(); });
    wc.on('did-navigate', () => this.publish());
    wc.on('did-navigate-in-page', () => this.publish());
    wc.on('page-title-updated', () => this.publish());
    wc.on('did-start-loading', () => this.publish());
    wc.on('did-stop-loading', () => this.publish());
    wc.on('destroyed', () => { this.layout(); this.publish(); });
    wc.on('context-menu', (_e, params) => Menu.buildFromTemplate([
      ...(params.isEditable ? [{ role: 'cut' as const }, { role: 'copy' as const }, { role: 'paste' as const }, { type: 'separator' as const }] : params.selectionText ? [{ role: 'copy' as const }] : []),
      { label: 'Назад', enabled: wc.navigationHistory.canGoBack(), click: () => wc.navigationHistory.goBack() },
      { label: 'Вперёд', enabled: wc.navigationHistory.canGoForward(), click: () => wc.navigationHistory.goForward() },
      { label: 'Обновить', click: () => wc.reload() },
      ...(params.linkURL && /^https?:/.test(params.linkURL) ? [{ label: 'Открыть ссылку в новой вкладке', click: () => { void this.addTab(params.linkURL); } }] : []),
    ]).popup({ window: this.window }));
    this.layout(); this.publish();
    return view;
  }
  selectTab(id: number): void { this.pruneDestroyedTabs(); if (!this.tabs.has(id)) return; this.activeId = id; this.layout(); this.tabs.get(id)?.webContents?.focus(); this.publish(); }
  closeTab(id: number): void {
    const view = this.tabs.get(id); if (!view) return;
    this.tabs.delete(id); this.window.contentView.removeChildView(view);
    const wc = view.webContents; if (wc && !wc.isDestroyed()) wc.close();
    if (!this.tabs.size) { void this.close(); return; }
    if (this.activeId === id) this.activeId = [...this.tabs.keys()].at(-1)!;
    this.layout(); this.publish();
  }
  async navigate(input: string): Promise<void> {
    const raw = input.trim();
    const url = webUrl(/^https?:\/\//i.test(raw) ? raw : raw.includes('.') || raw.startsWith('localhost') ? `https://${raw}` : `https://duckduckgo.com/?q=${encodeURIComponent(raw)}`);
    try { await this.tabs.get(this.activeId)?.webContents.loadURL(url); } catch { /* Chromium error page. */ }
    this.publish();
  }
  async action(action: string): Promise<void> {
    this.pruneDestroyedTabs();
    const wc = this.tabs.get(this.activeId)?.webContents;
    if (action === 'newTab') await this.addTab();
    if (action === 'back' && wc?.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
    if (action === 'forward' && wc?.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
    if (action === 'reload') wc?.reload();
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.closing = (async () => {
      // Closing native contents can synchronously emit loading/title events.
      // Remove all tabs before those events publish another state snapshot.
      const views = [...this.tabs.values()]; this.tabs.clear(); this.activeId = 0;
      for (const view of views) {
        if (!this.window.isDestroyed()) this.window.contentView.removeChildView(view);
        const wc = view.webContents; if (wc && !wc.isDestroyed()) wc.close();
      }
      try { await this.beforeClose(); } finally { this.shutting = true; if (!this.window.isDestroyed()) this.window.destroy(); }
    })();
    return this.closing;
  }
}
