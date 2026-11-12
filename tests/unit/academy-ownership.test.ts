import {expect,it} from 'vitest';
// @ts-expect-error runtime module
import {AcademyOwnership} from '../../electron/academy/ownership.mjs';
it('retains scoped cancellation arriving before the action is registered',async()=>{
 const ownership=new AcademyOwnership();let started=false;
 await ownership.cancel('profile-a','operation');
 await expect(ownership.run('profile-a','operation',async()=>{started=true;return {};},async()=>{})).rejects.toThrow(/отменена/);
 expect(started).toBe(false);
 expect(await ownership.run('profile-b','operation',async()=>({}),async()=>42)).toBe(42);
});
it('closes a page created after cancellation without starting the quiz',async()=>{
 const ownership=new AcademyOwnership();let finish!: (value:any)=>void;let submitted=false,closed=false;
 const created=new Promise(r=>{finish=r;});
 const action=ownership.run('profile','operation',()=>created,async()=>{submitted=true;}).catch((e:any)=>e);
 await ownership.cancel('profile','operation');
 finish({close:async()=>{closed=true;}});
 expect(await action).toBeInstanceOf(Error);expect(closed).toBe(true);expect(submitted).toBe(false);
});
