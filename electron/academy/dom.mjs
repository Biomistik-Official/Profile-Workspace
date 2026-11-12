// Serialized into the selected page. No cookies, storage, or credentials are read.
export function inspectPage(action='read', argument=null) {
  const norm=s=>String(s).normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
  const visible=e=>!!e.getClientRects().length && getComputedStyle(e).visibility!=='hidden';
  const text=document.body?.innerText || '';
  const leaves=[...document.querySelectorAll('button,[role="button"],div,span,p,a')].filter(e=>{
    if(!visible(e)||!e.innerText?.trim()) return false;
    return ![...e.children].some(c=>visible(c)&&norm(c.innerText)===norm(e.innerText));
  });
  const match=text.match(/Question\s+(\d+\s*\/\s*\d+)\s*([\s\S]*?\?)/i);
  const state=match ? {step:match[1],question:match[2].trim(),options:[...new Set(leaves.map(e=>e.innerText.trim()).filter(t=>t.length<500))]} :
    /(?:Final score:\s*A\+|You scored A\+)/i.test(text) ? {complete:true,grade:'A+'} :
    /Final score:/i.test(text) ? {complete:true,grade:'other'} : {loading:true};
  if(action==='read') return state;
  if(action==='answer') {
    if(state.question!==argument.question||state.step!==argument.step) throw new Error('Question changed before click');
    const choices=leaves.filter(e=>norm(e.innerText)===norm(argument.answer));
    if(choices.length!==1) throw new Error('Answer element is missing or ambiguous');
    const choice=choices[0];
    if(choice.closest('[disabled],[aria-disabled="true"]')) throw new Error('Answer is disabled');
    choice.click(); return true;
  }
  if(action==='claim') {
    const cards=[...document.querySelectorAll('li')].filter(e=>e.innerText.includes(argument));
    const card=cards.filter(e=>!e.querySelector('li'))[0];
    if(!card) return {status:'waiting'};
    if(/\bclaimed\b/i.test(card.innerText)) return {status:'claimed'};
    const button=[...card.querySelectorAll('button,a,[role="button"]')].find(e=>{
      if(e.querySelector('button,[role="button"]'))return false;
      const label=e.getAttribute('aria-label')||e.querySelector('.outlined-text__text')?.textContent||e.innerText;
      return /^(?:claim\s+200\s*xp\s*)+$/i.test(label.trim());
    });
    if(!button||button.disabled) return {status:'waiting'};
    button.click(); return {status:'clicked'};
  }
  throw new Error('Unsupported action');
}
