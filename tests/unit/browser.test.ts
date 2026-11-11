import { EventEmitter } from 'node:events';
import { beforeEach, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({ views: [] as any[], windows: [] as any[] }));
vi.mock('electron', () => ({
  BrowserWindow: class extends EventEmitter {
    webContents = Object.assign(new EventEmitter(), { on: () => {}, setWindowOpenHandler: () => {}, send: vi.fn() });
    contentView = { addChildView: vi.fn(), removeChildView: vi.fn() };
    constructor() { super(); native.windows.push(this); }
    isDestroyed() { return false; }
    getContentSize() { return [1280, 850]; }
    destroy() { this.emit('closed'); }
  },
  WebContentsView: class {
    private destroyed = false;
    private wc = Object.assign(new EventEmitter(), {
      id: native.views.length + 1, getTitle: () => 'Test', getURL: () => 'https://example.com/',
      isLoading: () => false, isDestroyed: () => this.destroyed,
      navigationHistory: { canGoBack: () => false, canGoForward: () => false },
      setWebRTCIPHandlingPolicy: () => {}, setWindowOpenHandler: () => {}, loadURL: vi.fn(async () => {}),
      close: () => { this.destroyed = true; this.wc.emit('did-stop-loading'); this.wc.emit('destroyed'); },
    });
    get webContents() { return this.destroyed ? undefined : this.wc; }
    constructor() { native.views.push(this); }
    setVisible() {} setBounds() {}
    destroyContents() { this.wc.close(); }
  },
  dialog: { showErrorBox: vi.fn() }, Menu: { buildFromTemplate: vi.fn() },
}));
import { ProfileBrowser } from '../../electron/browser';
import type { Profile } from '../../shared/types';
beforeEach(() => { native.views.length = 0; native.windows.length = 0; });
function browser() { return new ProfileBrowser({ name: 'Test' } as Profile, {} as any, '', async () => {}, () => {}); }

it('uses Google for new tabs and plain search queries while preserving explicit URLs', async () => {
  const b = browser(); await b.addTab();
  expect(native.views[0].webContents.loadURL).toHaveBeenLastCalledWith('https://www.google.com/');
  await b.navigate('чай с лимоном');
  expect(native.views[0].webContents.loadURL).toHaveBeenLastCalledWith('https://www.google.com/search?q=%D1%87%D0%B0%D0%B9%20%D1%81%20%D0%BB%D0%B8%D0%BC%D0%BE%D0%BD%D0%BE%D0%BC');
  await b.navigate('https://example.com/account');
  expect(native.views[0].webContents.loadURL).toHaveBeenLastCalledWith('https://example.com/account');
  await b.close();
});

it('clears tabs before close events can publish destroyed webContents', async () => {
  const b = browser(); await b.addTab('https://example.com/one'); await b.addTab('https://example.com/two');
  await expect(b.close()).resolves.toBeUndefined();
  expect(b.state().tabs).toEqual([]);
});

it('handles a tab destroyed externally while other tabs remain usable', async () => {
  const b = browser(); await b.addTab('https://example.com/one'); await b.addTab('https://example.com/two');
  expect(() => native.views[1].destroyContents()).not.toThrow();
  expect(b.state().tabs).toHaveLength(1);
  expect(b.state().activeId).toBe(1);
  expect(() => b.setSitesOpen(true)).not.toThrow();
  await b.close();
});
