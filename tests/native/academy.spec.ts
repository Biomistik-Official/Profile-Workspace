import {expect,test} from '@playwright/test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Camoufox} from 'camoufox';
// @ts-expect-error runtime ESM module
import {academyAction,withAcademyDeadline} from '../../electron/academy/engine.mjs';
const runtimeExecutable=join(process.env.LOCALAPPDATA!,'Profile Workspace','Engines','camoufox-0.5.9','camoufox.exe');

const courses=[
 {slug:'top-tips-for-maintaining-multiple-channels',question:'What is the most important thing to consider when making a new channel?',answer:'The production of your main channel',wrong:'The production of your new channel'},
 {slug:'developing-a-content-strategy',question:'How often should you check your bookmarked creators?',answer:'Almost every day',wrong:'Every month'},
 {slug:'creating-a-cohesive-visual-identity',question:'What are the required dimensions for a YouTube banner?',answer:'2560x1440',wrong:'1920x1080'}
];
function fixture(url:string,unknown=false,hung=false) {
 return `<body><script>
 const courses=${JSON.stringify(courses)};
 const videos=courses.map((v,i)=>({...v,id:'v'+i}));
 const store={rawVideos:videos,rawVideosById:{},getVideoById:async id=>{
   if(${hung})await new Promise(()=>{});
   const v=videos.find(v=>v.id===id);
   store.rawVideosById[id]={slug:v.slug,quizQuestions:[{question:${unknown?'"Unknown added question?"':'v.question'},answers:{0:v.wrong,1:v.answer}}]};
 }};
 window.useNuxtApp=()=>({vueApp:{config:{globalProperties:{$pinia:{_s:new Map([['newAcademyStore',store]])}}}}});
 const slug=location.pathname.split('/').pop();const c=courses.find(c=>c.slug===slug);
 window.submit=()=>{localStorage.setItem('grade-'+slug,'A+');localStorage.setItem('answers',+(localStorage.answers||0)+1);document.querySelector('main').innerHTML='Final score: A+';};
 if(c){
   if(location.search){document.body.insertAdjacentHTML('beforeend','<main>Question 1/1<h2>'+c.question+'</h2><button onclick="window.wrongAnswer=true">'+c.wrong+'</button><button onclick="submit()">'+c.answer+'</button></main>');}
   else document.body.insertAdjacentHTML('beforeend',localStorage.getItem('grade-'+slug)==='A+'?'You scored A+':'TAKE THE QUIZ');
 }else if(location.pathname==='/en/home'){
  const titles=['Complete 3 Academy Quizzes','Get a Gold Pen award from a Creator Academy Quiz'];
  const ul=document.createElement('ul');document.body.append(ul);
  for(const [i,title] of titles.entries()){
    const li=document.createElement('li');const a=document.createElement('a');a.href='/en/home/quest/'+i;a.innerHTML='<p>'+title+'</p>';li.append(a);ul.append(li);
    if(localStorage.getItem('claimed-'+i)){a.append(' Claimed');continue;}
    const b=document.createElement('button');b.innerHTML='<span>Claim 200 XP</span><span>Claim 200 XP</span><span>Claim 200 XP</span>';
    b.onclick=e=>{e.preventDefault();e.stopPropagation();localStorage.setItem('claimed-'+i,'yes');a.innerHTML='<p>'+title+'</p><span>Claimed</span>';};a.append(b);
  }
  ul.insertAdjacentHTML('beforeend','<li>Unrelated quest<button onclick="localStorage.wrongClaim=1">Claim 200 XP</button></li>');
 }
 </script></body>`;
}

test('native Academy analyzes, completes, skips saved exams and claims only the two rewards',async()=>{
 const data=await mkdtemp(join(tmpdir(),'academy-native-'));
 const context=await Camoufox({persistent_context:true,user_data_dir:data,executable_path:runtimeExecutable,main_world_eval:true,headless:true,os:'windows',exclude_addons:['UBO']});
 try {
  await context.route('https://creators.supercell.com/**',async route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url())}));
  const page=await context.newPage();
  await page.goto('https://creators.supercell.com/en/home');
  await page.evaluate(()=>localStorage.setItem('account-marker','retained'));
  const analysis=await academyAction(page,{action:'analyze'});
  expect(analysis.ready).toBe(true);expect(analysis.total).toBe(3);
  for(const c of courses)expect(await academyAction(page,{action:'quiz',slug:c.slug})).toMatchObject({grade:'A+'});
  expect(await academyAction(page,{action:'quiz',slug:courses[0].slug})).toMatchObject({grade:'A+',alreadyComplete:true});
  const claims=await academyAction(page,{action:'claim'});
  expect(claims.claimed).toHaveLength(2);
  expect(await page.evaluate(()=>({answers:localStorage.answers,marker:localStorage.getItem('account-marker'),wrong:localStorage.getItem('wrongClaim')}))).toEqual({answers:'3',marker:'retained',wrong:null});
  await context.unroute('https://creators.supercell.com/**');
  await context.route('https://creators.supercell.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url(),true)}));
  const changed=await academyAction(page,{action:'analyze'});
  expect(changed.ready).toBe(false);expect(changed.unresolved).toHaveLength(3);
  await expect(academyAction(page,{action:'quiz',slug:courses[0].slug})).rejects.toThrow(/новые вопросы/);
  expect(await page.evaluate(()=>localStorage.answers)).toBe('3');
  await context.unroute('https://creators.supercell.com/**');
  await context.route('https://creators.supercell.com/**',route=>route.fulfill({contentType:'text/html',body:fixture(route.request().url(),false,true)}));
  const stalled=await context.newPage();
  await expect(withAcademyDeadline(stalled,()=>academyAction(stalled,{action:'analyze'}),3000)).rejects.toThrow();
  expect(stalled.isClosed()).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('account-marker'))).toBe('retained');
 }finally{await context.close();await rm(data,{recursive:true,force:true});}
});
