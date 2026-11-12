import { expect, it } from 'vitest';
import { validateAcademyRequest } from '../../core/academy';
// @ts-expect-error runtime module
import {withAcademyDeadline} from '../../electron/academy/engine.mjs';

const id='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
it('accepts only fixed Academy actions and course slugs',()=>{
  expect(validateAcademyRequest({id,action:'analyze'})).toEqual({id,action:'analyze'});
  expect(validateAcademyRequest({id,action:'quiz',slug:'developing-a-content-strategy'}).slug).toBe('developing-a-content-strategy');
  for(const input of [{id,action:'evaluate',script:'document.cookie'},{id,action:'quiz',slug:'https://example.com'},
    {id,action:'quiz'},{id:'../other',action:'claim'},{id,action:'claim',url:'https://example.com'},null]) {
    expect(()=>validateAcademyRequest(input)).toThrow();
  }
});
it('interrupts a hung website promise by closing only the Academy tab',async()=>{
  let closed=false;
  const page={close:async()=>{closed=true;}};
  await expect(withAcademyDeadline(page,()=>new Promise(()=>{}),5)).rejects.toThrow(/время/);
  expect(closed).toBe(true);
});
