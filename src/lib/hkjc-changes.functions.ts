import { createServerFn } from "@tanstack/react-start";
import type { HkjcChange } from "./hkjc-changes";
import type { ChangeProgress } from './racing-change-progress';

export type HkjcChangesSnapshot = { race_date: string; venue: string; fetched_at: string; source_url: string; sha256: string; changes: HkjcChange[] } | null;

export const getHkjcChanges = createServerFn({ method: "GET" })
  .inputValidator((d: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d?.date ?? "")) throw new Error("賽日日期無效");
    return d;
  })
  .handler(async ({ data }): Promise<HkjcChangesSnapshot> => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { readLatestHkjcChanges } = await import("./hkjc-changes.server");
    return (await readLatestHkjcChanges(data.date)) as HkjcChangesSnapshot;
  });

export const getChangeProgress = createServerFn({ method: 'GET' })
  .inputValidator((data: { date: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data?.date ?? '')) throw new Error('賽日日期無效');
    return data;
  })
  .handler(async ({ data }): Promise<ChangeProgress[]> => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'no-store');
    const { createClient } = await import('@supabase/supabase-js');
    const key = process.env['SUPABASE_PUBLISHABLE_KEY']!;
    const sb = createClient<import('@/integrations/supabase/types').Database>(process.env['SUPABASE_URL']!, key, {
      auth: { persistSession:false, autoRefreshToken:false },
      global: { fetch:(input,init) => { const h=new Headers(init?.headers); if(key.startsWith('sb_') && h.get('Authorization')===`Bearer ${key}`) h.delete('Authorization'); h.set('apikey',key); return fetch(input,{...init,headers:h}); } },
    });
    const result = await sb.from('racing_change_updates').select('revision,phase,requested_at,recomputed_at,generated_at,checked_at').eq('race_date',data.date).order('checked_at',{ascending:false}).limit(100);
    if(result.error) throw new Error('更新狀態暫時未能讀取');
    return result.data ?? [];
  });
