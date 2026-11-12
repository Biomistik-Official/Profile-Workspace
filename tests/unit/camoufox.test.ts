import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import type { Profile } from '../../shared/types';
const state = vi.hoisted(() => ({ worker: null as any }));
vi.mock('electron', () => ({ utilityProcess: { fork: () => state.worker } }));
import { CamoufoxController } from '../../electron/camoufox';
const profile: Profile = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', engine: 'camoufox', name: 'Native', notes: '', tags: [], proxyId: null, startUrl: 'https://example.com', restoreSessionCookies: true, createdAt: '', updatedAt: '', lastOpenedAt: null };
function worker() { return Object.assign(new EventEmitter(), { messages: [] as any[], postMessage(message: any) { this.messages.push(message); }, kill() { this.emit('exit'); } }); }
afterEach(() => vi.useRealTimers());

it('does not run Academy against a stopped profile or open a replacement context', async () => {
  state.worker = worker();
  const controller = new CamoufoxController('test', () => {}, async () => {}, () => {});
  await expect(controller.academy(profile,{id:profile.id,action:'analyze'})).rejects.toThrow(/запущен/);
  expect(state.worker.messages).toHaveLength(0);
});

it('serializes Academy requests on one owned profile while retaining stop ownership', async () => {
  state.worker=worker();
  const controller=new CamoufoxController('test',()=>{},async()=>{},()=>{});
  const start=controller.start(profile,[]);state.worker.emit('message',{requestId:1,result:undefined});await start;
  const first=controller.academy(profile,{id:profile.id,action:'analyze'});
  await expect(controller.academy(profile,{id:profile.id,action:'claim'})).rejects.toThrow(/выполняется/);
  expect(controller.isBusy(profile.id)).toBe(true);
  state.worker.emit('message',{requestId:2,result:{total:24}});
  await expect(first).resolves.toEqual({total:24});
  expect(controller.isRunning(profile.id)).toBe(true);
  controller.dispose();
});
it('allows scoped cancellation to interrupt a pending Academy action without stopping its context',async()=>{
  state.worker=worker();
  const controller=new CamoufoxController('test',()=>{},async()=>{},()=>{});
  const start=controller.start(profile,[]);state.worker.emit('message',{requestId:1,result:undefined});await start;
  const operationId='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  const action=controller.academy(profile,{id:profile.id,action:'analyze',operationId}).catch(e=>e);
  const cancel=controller.academy(profile,{id:profile.id,action:'cancel',operationId});
  const request=state.worker.messages.find((m:any)=>m.command==='cancelAcademy');
  expect(request.args.operationId).toBe(operationId);
  state.worker.emit('message',{requestId:request.requestId,result:{cancelled:true}});
  await expect(cancel).resolves.toEqual({cancelled:true});
  state.worker.emit('message',{requestId:2,error:'Cancelled'});
  expect(await action).toBeInstanceOf(Error);
  expect(controller.isRunning(profile.id)).toBe(true);
  expect(controller.isBusy(profile.id)).toBe(false);
  controller.dispose();
});

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
