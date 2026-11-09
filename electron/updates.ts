import type { UpdateState } from '../shared/types';
export interface UpdaterPort {
  autoDownload: boolean; autoInstallOnAppQuit: boolean; autoRunAppAfterInstall: boolean;
  allowDowngrade: boolean; allowPrerelease: boolean; disableWebInstaller: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  checkForUpdates(): Promise<unknown>;
}
export class UpdateController {
  private state: UpdateState;
  private inFlight = false;
  constructor(private updater: UpdaterPort, private enabled: boolean, private changed: () => void) {
    this.state = { status: enabled ? 'idle' : 'disabled' };
    updater.autoDownload = enabled; updater.autoInstallOnAppQuit = enabled; updater.autoRunAppAfterInstall = false;
    updater.allowDowngrade = false; updater.allowPrerelease = false; updater.disableWebInstaller = true;
    updater.on('error', () => { if (enabled && this.state.status !== 'ready') this.set({ status: 'error' }); });
    if (!enabled) return;
    updater.on('checking-for-update', () => this.set({ status: 'checking' }));
    updater.on('update-not-available', () => this.set({ status: 'idle' }));
    updater.on('update-available', info => this.set({ status: 'downloading', version: info.version, percent: 0 }));
    updater.on('download-progress', info => this.set({ ...this.state, status: 'downloading', percent: Math.max(0, Math.min(100, Math.round(info.percent))) }));
    updater.on('update-downloaded', info => this.set({ status: 'ready', version: info.version, percent: 100 }));
  }
  private set(state: UpdateState): void { this.state = state; this.changed(); }
  snapshot(): UpdateState { return { ...this.state }; }
  async check(): Promise<void> {
    if (!this.enabled || this.inFlight || ['checking', 'downloading', 'ready'].includes(this.state.status)) return;
    this.inFlight = true; this.set({ status: 'checking' });
    try { await this.updater.checkForUpdates(); } catch { if (this.state.status !== 'ready') this.set({ status: 'error' }); }
    finally { this.inFlight = false; }
  }
  start(): void {
    if (!this.enabled) return;
    setTimeout(() => { void this.check(); }, 15000).unref();
    setInterval(() => { void this.check(); }, 6 * 60 * 60 * 1000).unref();
  }
}
