export class AcademyCancelled extends Error {constructor(){super('Academy отменена.');}}
export class AcademyOwnership {
  active=new Map();
  cancelled=new Map();
  key(profile,operation){return `${profile}:${operation}`;}
  prune(){
    const now=Date.now();
    for(const [key,expires] of this.cancelled)if(expires<now)this.cancelled.delete(key);
    while(this.cancelled.size>512)this.cancelled.delete(this.cancelled.keys().next().value);
  }
  async cancel(profile,operation){
    this.prune();const key=this.key(profile,operation);
    // Retain early cancellations, including those overtaking their original RPC.
    this.cancelled.set(key,Date.now()+180000);this.prune();
    const page=this.active.get(key)?.page;
    if(page)await page.close().catch(()=>{});
    return {cancelled:true};
  }
  async run(profile,operation,create,action){
    this.prune();const key=this.key(profile,operation);
    if(this.cancelled.has(key))throw new AcademyCancelled();
    const entry={page:undefined};this.active.set(key,entry);
    try {
      entry.page=await create();
      if(this.cancelled.has(key)){await entry.page.close().catch(()=>{});throw new AcademyCancelled();}
      return await action(entry.page);
    }finally{this.active.delete(key);}
  }
}
