export class LaunchQueue {
  private pending: string[] = [];
  private active = new Set<string>();
  private maxConcurrent = 3;
  private delay = 600;
  private timer?: ReturnType<typeof setTimeout>;
  private nextStart = 0;
  private waiters: (() => void)[] = [];
  constructor(private start: (id: string) => Promise<void>, private changed: () => void) {}
  configure(input: { maxConcurrent: number; launchDelayMs: number }): void { this.maxConcurrent = input.maxConcurrent; this.delay = input.launchDelayMs; this.pump(); }
  enqueue(ids: string[]): void { for (const id of ids) if (!this.active.has(id) && !this.pending.includes(id)) this.pending.push(id); this.changed(); this.pump(); }
  cancel(ids?: string[]): void { this.pending = ids ? this.pending.filter(id => !ids.includes(id)) : []; if (!this.pending.length && this.timer) { clearTimeout(this.timer); this.timer = undefined; } this.changed(); this.settle(); }
  contains(id: string): boolean { return this.pending.includes(id) || this.active.has(id); }
  pendingIds(): string[] { return [...this.pending]; }
  state(): { pending: number; active: number } { return { pending: this.pending.length, active: this.active.size }; }
  idle(): Promise<void> { return !this.pending.length && !this.active.size ? Promise.resolve() : new Promise(r => this.waiters.push(r)); }
  private settle(): void { if (!this.pending.length && !this.active.size) this.waiters.splice(0).forEach(r => r()); }
  private pump(): void {
    if (this.timer || !this.pending.length || this.active.size >= this.maxConcurrent) { this.settle(); return; }
    const wait = this.nextStart - Date.now();
    if (wait > 0) { this.timer = setTimeout(() => { this.timer = undefined; this.pump(); }, wait); return; }
    const id = this.pending.shift()!; this.active.add(id); this.nextStart = Date.now() + this.delay; this.changed();
    void this.start(id).catch(() => {}).finally(() => { this.active.delete(id); this.changed(); this.pump(); this.settle(); });
    this.pump();
  }
}
