import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import type { Profile } from '../../shared/types';
const state = vi.hoisted(() => ({ worker: null as any }));
vi.mock('electron', () => ({ utilityProcess: { fork: () => state.worker } }));
import { CamoufoxController } from '../../electron/camoufox';
const profile: Profile = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', engine: 'camoufox', name: 'Native', notes: '', tags: [], proxyId: null, startUrl: 'https://example.com', restoreSessionCookies: true, createdAt: '', updatedAt: '', lastOpenedAt: null };
function worker() { return Object.assign(new EventEmitter(), { messages: [] as any[], postMessage(message: any) { this.messages.push(message); }, kill() { this.emit('exit'); } }); }
afterEach(() => vi.useRealTimers());

it('retains profile ownership after timeout until the queued stop is confirmed', async () => {
  vi.useFakeTimers(); state.worker = worker();
  const controller = new CamoufoxController('test', () => {}, async () => {}, () => {});
  const start = controller.start(profile, []).catch(error => error);
  await vi.advanceTimersByTimeAsync(180000);
  expect(await start).toBeInstanceOf(Error);
  expect(controller.isRunning(profile.id) || controller.isBusy(profile.id)).toBe(true);
  expect(state.worker.messages.some((m: any) => m.command === 'stop')).toBe(true);
  state.worker.emit('message', { requestId: 1, result: undefined });
  const stop = state.worker.messages.find((m: any) => m.command === 'stop');
  state.worker.emit('message', { event: 'closed', id: profile.id, cookies: [] });
  state.worker.emit('message', { requestId: stop.requestId, result: [] });
  await controller.flush();
  expect(controller.isRunning(profile.id) || controller.isBusy(profile.id)).toBe(false);
  controller.dispose();
});
it('keeps a manually closed profile busy until its final encrypted snapshot is saved', async () => {
  state.worker = worker(); let finish!: () => void;
  const saved = new Promise<void>(resolve => { finish = resolve; });
  const controller = new CamoufoxController('test', () => {}, () => saved, () => {});
  const start = controller.start(profile, []);
  state.worker.emit('message', { requestId: 1, result: undefined }); await start;
  state.worker.emit('message', { event: 'closed', id: profile.id, cookies: [] });
  expect(controller.isRunning(profile.id)).toBe(false);
  expect(controller.isBusy(profile.id)).toBe(true);
  finish(); await controller.flush();
  expect(controller.isBusy(profile.id)).toBe(false);
  controller.dispose();
});
it('releases ownership when a timed-out launch later fails without creating a browser', async () => {
  vi.useFakeTimers(); state.worker = worker();
  const controller = new CamoufoxController('test', () => {}, async () => {}, () => {});
  const start = controller.start(profile, []).catch(error => error);
  await vi.advanceTimersByTimeAsync(180000); await start;
  state.worker.emit('message', { requestId: 1, error: 'Launch failed' });
  const stop = state.worker.messages.find((m: any) => m.command === 'stop');
  state.worker.emit('message', { requestId: stop.requestId, result: [] });
  await controller.flush();
  expect(controller.isRunning(profile.id) || controller.isBusy(profile.id)).toBe(false);
  controller.dispose();
});
