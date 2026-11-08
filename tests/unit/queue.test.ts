import { expect, it } from 'vitest';
import { LaunchQueue } from '../../core/queue';
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
it('limits concurrent starts and ignores duplicate queued requests', async () => {
  const started: string[] = []; const release: (() => void)[] = [];
  const queue = new LaunchQueue(async id => { started.push(id); await new Promise<void>(r => release.push(r)); }, () => {});
  queue.configure({ maxConcurrent: 2, launchDelayMs: 0 });
  queue.enqueue(['a', 'b', 'c', 'a']); await tick();
  expect(started).toEqual(['a', 'b']);
  queue.enqueue(['a', 'c']); release.shift()!(); await tick();
  expect(started).toEqual(['a', 'b', 'c']);
  release.splice(0).forEach(r => r()); await queue.idle();
  expect(queue.state()).toEqual({ pending: 0, active: 0 });
});
it('cancels pending work and continues after a failed start', async () => {
  const started: string[] = [];
  const queue = new LaunchQueue(async id => { started.push(id); if (id === 'bad') throw new Error('failed'); }, () => {});
  queue.configure({ maxConcurrent: 1, launchDelayMs: 15 });
  queue.enqueue(['bad', 'good']); await queue.idle();
  expect(started).toEqual(['bad', 'good']);
  queue.enqueue(['first', 'cancelled']); queue.cancel(); await queue.idle();
  expect(started).not.toContain('cancelled');
});
