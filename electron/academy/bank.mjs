// Reads only course questions and option text already delivered by the website.
// No scores, account information, correct-answer flags, or credentials are collected.
export async function readCourseBanks(slugs) {
  if(location.origin!=='https://creators.supercell.com')throw new Error('Unexpected origin');
  const app=window.useNuxtApp?.();
  const getStore=()=>app?.vueApp.config.globalProperties.$pinia?._s.get('newAcademyStore');
  let store=getStore();
  if(!store?.rawVideos?.length) {
    const router=app?.vueApp.config.globalProperties.$router;
    if(router)await router.push('/en/features/academy');
    for(let i=0;i<20;i++) {
      store=getStore();
      if(store&&typeof store.getVideoById==='function')break;
      await new Promise(r=>setTimeout(r,250));
    }
    if(!store?.rawVideos?.length&&typeof store?.getVideos==='function')await store.getVideos();
  }
  if(!store?.rawVideos?.length||typeof store.getVideoById!=='function')throw new Error('Academy data not ready in this page');
  const result=[];
  for(const slug of slugs) {
    const video=store.rawVideos.find(v=>v.slug===slug);
    if(!video)throw new Error(`Course unavailable: ${slug}`);
    await store.getVideoById(video.id);
    const loaded=Object.values(store.rawVideosById).find(v=>v.slug===slug);
    if(!loaded?.quizQuestions?.length)throw new Error(`Questions unavailable: ${slug}`);
    result.push({slug,questions:loaded.quizQuestions.map(q=>({question:String(q.question),options:Object.values(q.answers).map(String)}))});
  }
  return result;
}
