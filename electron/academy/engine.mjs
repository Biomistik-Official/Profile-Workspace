import {quizzes,analyzeBanks,solveQuiz} from './core.mjs';
import {readCourseBanks} from './bank.mjs';
import {inspectPage} from './dom.mjs';
const origin='https://creators.supercell.com';
const titles=['Complete 3 Academy Quizzes','Get a Gold Pen award from a Creator Academy Quiz'];
export class AcademyError extends Error {}
const approvedPages=new WeakMap();
export async function withAcademyDeadline(page,action,timeout=120000) {
  let timer;
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      void page.close().catch(()=>{}).finally(()=>reject(new AcademyError('Истекло время Academy. Закрыта только вкладка автоматизации; профиль сохранён.')));
    },timeout);
  });
  try{return await Promise.race([action(),deadline]);}finally{clearTimeout(timer);}
}

export async function academyAction(page,input) {
  return withAcademyDeadline(page,()=>performAction(page,input));
}
async function performAction(page,input) {
  if(!input||!['analyze','quiz','claim'].includes(input.action)||input.action==='quiz'&&!quizzes.includes(input.slug))throw new AcademyError('Неизвестное действие или курс Academy.');
  const visit=async path=>{
    await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:30000});
    if(new URL(page.url()).origin!==origin)throw new AcademyError('Выполните вход в Supercell Creators вручную, затем повторите запуск.');
  };
  const read=()=>page.evaluate(inspectPage);
  try {
    await page.bringToFront();
    if(input.action==='analyze') {
      await visit('/en/features/academy');
      let ready=false;
      for(let i=0;i<40;i++) {
        if(await page.evaluate('mw:typeof window.useNuxtApp === "function"')){ready=true;break;}
        await new Promise(r=>setTimeout(r,500));
      }
      if(!ready)throw new AcademyError('Academy не загрузилась. Проверьте вход в Supercell Creators.');
      const banks=await page.evaluate(`mw:(${readCourseBanks.toString()})(${JSON.stringify(quizzes)})`);
      const analysis=analyzeBanks(banks);
      if(analysis.ready)approvedPages.set(page,true);else approvedPages.delete(page);
      return analysis;
    }
    if(input.action==='quiz') {
      if(!approvedPages.has(page)) {
        const analysis=await performAction(page,{action:'analyze'});
        if(!analysis.ready)throw new AcademyError('Найдены новые вопросы. Сначала разберите полный банк этого профиля.');
      }
      const path=`/en/features/academy/video/${input.slug}`;
      await visit(path);
      await page.waitForFunction(()=>/You scored A\+|TAKE THE QUIZ/i.test(document.body.innerText),{},{timeout:20000});
      const saved=await read();
      if(saved.complete&&saved.grade==='A+')return {slug:input.slug,grade:'A+',alreadyComplete:true};
      await visit(path+'?quiz=1');
      await solveQuiz({read,answer:async(answer,state)=>{
        const current=await read();
        if(current.question!==state.question||current.step!==state.step)throw new AcademyError('Вопрос изменился перед ответом; повторите запуск.');
        const option=page.getByText(answer.trim(),{exact:true});
        if(await option.count()!==1)throw new AcademyError('Ответ на странице неоднозначен.');
        await option.click({timeout:10000});
      }});
      // Reload the course without ?quiz=1: verify the saved result, never reopen a completed exam.
      await visit(path);
      await page.waitForFunction(()=>/You scored A\+/i.test(document.body.innerText),{},{timeout:20000});
      return {slug:input.slug,grade:'A+',alreadyComplete:false};
    }
    await visit('/en/home');
    const claimed=[];
    for(const title of titles) {
      const card=page.locator('li').filter({has:page.getByText(title,{exact:true})});
      await card.waitFor({state:'visible',timeout:15000});
      if(await card.count()!==1)throw new AcademyError(`Неоднозначная карточка награды: ${title}`);
      if(!/\bclaimed\b/i.test(await card.innerText())) {
        const button=card.locator('button,[role="button"]').filter({hasText:/claim\s+200\s*xp/i});
        if(await button.count()!==1)throw new AcademyError(`Награда ещё недоступна: ${title}`);
        await button.click({timeout:10000});
        await page.waitForFunction(title=>[...document.querySelectorAll('li')].some(e=>e.innerText.includes(title)&&/\bclaimed\b/i.test(e.innerText)),title,{timeout:30000});
      }
      claimed.push(title);
    }
    return {claimed};
  }catch(error) {
    if(error instanceof AcademyError)throw error;
    if(error.message?.startsWith('Unknown question:')||error.message?.startsWith('Expected A+'))throw new AcademyError(error.message.slice(0,3000));
    throw new AcademyError('Academy не завершена: проверьте вход в Supercell, доступность курса/награды и соединение. Существующие результаты сохранены.',{cause:error});
  }
}
