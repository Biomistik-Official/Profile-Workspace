import type {AcademyRequest} from '../shared/types';
export const academyCourses=['top-tips-for-maintaining-multiple-channels','developing-a-content-strategy','creating-a-cohesive-visual-identity'] as const;
export function validateAcademyRequest(input:unknown):AcademyRequest {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Некорректный запрос Academy.');
  const value=input as Record<string,unknown>;
  if(Object.keys(value).some(k=>!['id','action','slug','operationId'].includes(k))||typeof value.id!=='string'||!/^[a-f0-9-]{36}$/.test(value.id))throw new Error('Некорректный профиль Academy.');
  if(!['analyze','quiz','claim','cancel'].includes(value.action as string))throw new Error('Неизвестное действие Academy.');
  if(value.operationId!==undefined&&(typeof value.operationId!=='string'||!/^[a-f0-9-]{36}$/.test(value.operationId))||value.action==='cancel'&&!value.operationId)throw new Error('Некорректная операция Academy.');
  if(value.action==='quiz'&&!academyCourses.includes(value.slug as any)||value.action!=='quiz'&&value.slug!==undefined)throw new Error('Неизвестный курс Academy.');
  return {id:value.id,action:value.action as AcademyRequest['action'],...(value.action==='quiz'?{slug:value.slug as string}:{}),...(value.operationId?{operationId:value.operationId as string}:{})};
}
