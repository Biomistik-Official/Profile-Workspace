import {_electron as electron,expect,test} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
test('Academy bridge validates input and refuses stopped profiles without launching browsers',async()=>{
 const data=await mkdtemp(join(tmpdir(),'academy-ipc-'));
 const executablePath=process.env.PROFILE_WORKSPACE_TEST_EXECUTABLE;
 const app=await electron.launch({executablePath,args:executablePath?[]:['.'],env:{...process.env,PROFILE_WORKSPACE_DATA_DIR:data}});
 try {
  const page=await app.firstWindow();
  const id=await page.evaluate(async()=>{
    await window.workspace.saveProfile({name:'Academy test',engine:'camoufox'});
    return (await window.workspace.snapshot()).profiles[0].id;
  });
  await expect(page.evaluate(id=>window.workspace.academy({id,action:'analyze'}),id)).rejects.toThrow(/Откройте/);
  await expect(page.evaluate(id=>window.workspace.academy({id,action:'quiz',slug:'https://example.com'}),id)).rejects.toThrow(/курс/);
  expect(await page.evaluate(async id=>(await window.workspace.snapshot()).runtime[id]?.status,id)).not.toBe('running');
 }finally{await app.close();await rm(data,{recursive:true,force:true});}
});
