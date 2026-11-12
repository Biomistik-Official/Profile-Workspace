import { utilityProcess, type UtilityProcess } from 'electron';
import { join } from 'node:path';
import {randomUUID} from 'node:crypto';
import type { AcademyRequest, EngineState, PortableCookie, Profile, Site } from '../shared/types';

export class CamoufoxController {
  private worker?: UtilityProcess;
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout>; profileId?: string; command: string }>();
  private running = new Set<string>();
  private saves = new Set<Promise<void>>();
  private operations = new Set<Promise<unknown>>();
  private busy = new Map<string, number>();
  private saveFailure?: Error;
  private academyPending=new Set<string>();
  state: EngineState = { status: 'checking' };
  constructor(private root: string, private changed: () => void,
    private saved: (id: string, cookies: PortableCookie[], ending: boolean) => Promise<void>, private closed: (id: string) => void) {}
  private lock(id: string): void { this.busy.set(id, (this.busy.get(id) ?? 0) + 1); }
  private unlock(id: string): void { const count = (this.busy.get(id) ?? 1) - 1; if (count) this.busy.set(id, count); else this.busy.delete(id); }
  private connect(): UtilityProcess {
    if (this.worker) return this.worker;
    const worker = utilityProcess.fork(join(__dirname, 'camoufox-worker.mjs'), [], { serviceName: 'Profile Workspace Camoufox', stdio: 'ignore' });
    worker.on('message', message => {
      if (message.event === 'cookies' || message.event === 'closed') {
        this.lock(message.id);
        const save = Promise.resolve().then(() => this.saved(message.id, message.cookies, message.event === 'closed')).finally(() => { this.saves.delete(save); this.unlock(message.id); });
        this.saves.add(save);
        void save.catch(error => { this.saveFailure = error; });
        if (message.event === 'closed') { this.running.delete(message.id); this.closed(message.id); }
        return;
      }
      const pending = this.pending.get(message.requestId); if (!pending) return;
      clearTimeout(pending.timer); this.pending.delete(message.requestId); if (pending.profileId) this.unlock(pending.profileId);
      if (pending.command === 'stop' && !message.error && pending.profileId && this.running.delete(pending.profileId)) this.closed(pending.profileId);
      if (message.error) pending.reject(new Error(message.error)); else pending.resolve(message.result);
    });
    worker.on('exit', () => {
      this.worker = undefined;
      for (const pending of this.pending.values()) { clearTimeout(pending.timer); if (pending.profileId) this.unlock(pending.profileId); pending.reject(new Error('Процесс Camoufox завершился. Данные профилей остаются на диске.')); }
      this.pending.clear();
      for (const id of this.running) this.closed(id);
      this.running.clear();
    });
    this.worker = worker; return worker;
  }
  request<T = unknown>(command: string, args: object = {}): Promise<T> {
    const worker = this.connect(), requestId = ++this.sequence;
    const id = (args as { profile?: Profile }).profile?.id;
    if (id) this.lock(id);
    const request = new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!id) this.pending.delete(requestId);
        reject(Object.assign(new Error('Camoufox не ответил вовремя. Операция завершится перед разблокировкой профиля.'), { pending: !!id }));
        if (id && command !== 'stop') void this.request('stop', { profile: (args as { profile: Profile }).profile }).catch(() => {});
      }, command === 'install' ? 1800000 : 180000);
      this.pending.set(requestId, { resolve, reject, timer, profileId: id, command }); worker.postMessage({ requestId, command, args: { root: this.root, ...args } });
    });
    if (id) { this.operations.add(request); void request.finally(() => this.operations.delete(request)).catch(() => {}); }
    return request;
  }
  async check(): Promise<void> { this.state = await this.request<EngineState>('status'); this.changed(); }
  async install(sites: Site[] = []): Promise<void> {
    if (this.state.status === 'installing') return;
    this.state = { status: 'installing' }; this.changed();
    try { this.state = await this.request<EngineState>('install', { sites }); }
    catch (error) { this.state = { status: 'error', error: (error as Error).message }; throw error; }
    finally { this.changed(); }
  }
  async start(profile: Profile, sessionCookies: PortableCookie[], proxy?: { server: string; username?: string; password?: string }, sites: Site[] = []): Promise<void> {
    this.running.add(profile.id);
    try { await this.request('start', { profile, sessionCookies, proxy, sites }); }
    catch (error) { if (!(error as Error & { pending?: boolean }).pending) this.running.delete(profile.id); throw error; }
  }
  isRunning(id: string): boolean { return this.running.has(id); }
  async academy(profile:Profile,input:AcademyRequest):Promise<unknown> {
    if(!this.isRunning(profile.id))throw new Error('Профиль Camoufox должен быть запущен.');
    if(input.action==='cancel')return this.request('cancelAcademy',{profile,operationId:input.operationId});
    if(this.academyPending.has(profile.id))throw new Error('В этом профиле уже выполняется Academy.');
    this.academyPending.add(profile.id);
    try{return await this.request('academy',{profile,academy:{...input,operationId:input.operationId??randomUUID()}});}
    finally{this.academyPending.delete(profile.id);}
  }
  isBusy(id: string): boolean { return this.busy.has(id); }
  focus(profile: Profile): void { void this.request('focus', { profile }).catch(() => {}); }
  async stop(profile: Profile): Promise<void> { if (this.running.has(profile.id)) await this.request('stop', { profile }); await this.flush(); }
  async flush(): Promise<void> {
    await Promise.all([...this.operations]);
    await Promise.all([...this.saves]);
    if (this.saveFailure) { const error = this.saveFailure; this.saveFailure = undefined; throw error; }
  }
  dispose(): void { this.worker?.kill(); }
}
