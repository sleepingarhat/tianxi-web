import {describe,it,expect,vi} from 'vitest';
vi.mock('@tanstack/react-start',()=>({createServerFn:()=>{const chain={middleware:()=>chain,inputValidator:()=>chain,handler:(fn:unknown)=>fn};return chain;}}));
vi.mock('@/integrations/supabase/auth-middleware',()=>({requireSupabaseAuth:{}}));
import {createAcceptanceInvoice,listAcceptanceInvoices} from './payment-acceptance.functions';
describe('小額驗收管理員授權',()=>{
 it.each([createAcceptanceInvoice,listAcceptanceInvoices])('非管理員不可讀取或建立付款',async(fn)=>{
  const from=vi.fn();const fetchMock=vi.fn();vi.stubGlobal('fetch',fetchMock);
  const invoke=fn as unknown as (value:unknown)=>Promise<unknown>;
  await expect(invoke({data:{confirm:true},context:{userId:'not-admin',supabase:{rpc:async()=>({data:false,error:null}),from}}})).rejects.toThrow('此操作只限管理員');
  expect(from).not.toHaveBeenCalled();expect(fetchMock).not.toHaveBeenCalled();vi.unstubAllGlobals();
 });
});