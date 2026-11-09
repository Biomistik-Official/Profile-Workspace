import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
import { UpdateController } from '../../electron/updates';

function setup(enabled = true) {
  const updater = Object.assign(new EventEmitter(), {
    autoDownload: false, autoInstallOnAppQuit: false, autoRunAppAfterInstall: true,
    allowDowngrade: true, allowPrerelease: true, disableWebInstaller: false,
    logger: null, checkForUpdates: vi.fn(async () => null),
  });
  const changed = vi.fn(); const controller = new UpdateController(updater, enabled, changed);
  return { updater, changed, controller };
}
it('disables network checks in portable, development and isolated instances', async () => {
  const { controller, updater } = setup(false); await controller.check();
  expect(controller.snapshot().status).toBe('disabled'); expect(updater.checkForUpdates).not.toHaveBeenCalled();
});
it('downloads stable upgrades and installs only on actual application quit', () => {
  const { updater } = setup();
  expect(updater).toMatchObject({ autoDownload: true, autoInstallOnAppQuit: true, autoRunAppAfterInstall: false,
    allowDowngrade: false, allowPrerelease: false, disableWebInstaller: true });
});
it('deduplicates checks, reports progress and retains downloaded update until quit', async () => {
  const { updater, controller } = setup();
  let resolve!: () => void;
  updater.checkForUpdates.mockImplementationOnce(() => new Promise(r => { resolve = () => r(null); }));
  const first = controller.check(); await controller.check(); expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  updater.emit('update-available', { version: '0.2.0' });
  updater.emit('download-progress', { percent: 52.2 });
  expect(controller.snapshot()).toMatchObject({ status: 'downloading', version: '0.2.0', percent: 52 });
  updater.emit('update-downloaded', { version: '0.2.0' }); resolve(); await first;
  await controller.check(); expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  expect(controller.snapshot()).toMatchObject({ status: 'ready', version: '0.2.0', percent: 100 });
});
it('keeps failures nonfatal and permits a later retry', async () => {
  const { updater, controller } = setup(); updater.checkForUpdates.mockRejectedValueOnce(new Error('offline'));
  await controller.check(); expect(controller.snapshot().status).toBe('error');
  updater.checkForUpdates.mockImplementationOnce(async () => { updater.emit('update-not-available', { version: '0.1.5' }); return null; });
  await controller.check(); expect(controller.snapshot().status).toBe('idle');
});
