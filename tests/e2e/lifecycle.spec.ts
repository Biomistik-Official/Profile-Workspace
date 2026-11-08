import { _electron as electron, test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('a second launch during shutdown does not access an already destroyed manager window', async () => {
  const data = await mkdtemp(join(tmpdir(), 'workspace-lifecycle-'));
  const executablePath = process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
  const application = await electron.launch({ executablePath, args: executablePath ? [] : ['.'], env: { ...process.env, PROFILE_WORKSPACE_DATA_DIR: data } });
  try {
    const page = await application.firstWindow();
    await expect(page.getByRole('heading', { name: 'Профили', exact: true })).toBeVisible();
    const result = await application.evaluate(({ app, BrowserWindow }) => {
      const manager = BrowserWindow.getAllWindows()[0];
      // Keep the test process alive after destroying the manager, as can happen
      // while async shutdown work is still pending in the first instance.
      new BrowserWindow({ show: false });
      manager.destroy();
      app.emit('second-instance', {}, [], process.cwd());
      return 'handled';
    });
    expect(result).toBe('handled');
  } finally {
    await application.close(); await rm(data, { recursive: true, force: true });
  }
});
