import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { isConfirmedComplete } from '@/lib/racing-results-schedule';

export const Route = createFileRoute('/api/public/jobs/racing-dividends')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const body = await request.json().catch(() => null);
    if (body?.kind !== 'refresh' || Object.keys(body).length !== 1) return Response.json({ error: 'invalid-body' }, { status: 400 });
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    try {
      const index = await supabaseAdmin.from('racing_result_collection_state').select('race_date,venue,expected_races').order('race_date',{ascending:false}).limit(2);
      if (index.error) throw new Error('dividend-meeting-index-failed');
      const meetings = new Map<string,{date:string;venue:string;count:number}>();
      for (const r of index.data ?? []) {
        const key = `${r.race_date}:${r.venue}`;
        const m = meetings.get(key) ?? {date:r.race_date,venue:r.venue,count:0};
        m.count = r.expected_races; meetings.set(key,m);
      }
      const { readOfficialResultMeetings } = await import('@/lib/racing-results-official.server');
      const official = await readOfficialResultMeetings();
      for (const m of official.meetings.filter(isConfirmedComplete)) meetings.set(`${m.date}:${m.venueCode}`,{date:m.date,venue:m.venueCode,count:m.totalNumberOfRace});
      const { collectOfficialDividends } = await import('@/lib/hkjc-dividends.server');
      const outcomes = await Promise.all([...meetings.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,2).map(async m => {
        try { return {ok:true,...await collectOfficialDividends(m.date,m.venue,m.count)}; }
        catch (error) { return {ok:false,date:m.date,error:error instanceof Error ? error.message : 'unknown'}; }
      }));
      const ok = outcomes.length > 0 && outcomes.every(o=>o.ok);
      if (!ok) {
        const { sendTelegramAlert } = await import('@/lib/telegramAlert.server');
        await sendTelegramAlert(`⚠️ 官方派彩自動核對未齊：${outcomes.filter(o=>!o.ok).map(o=>o.date).join('、')}；保留上次存證，五分鐘後自動重試。`).catch(()=>null);
      }
      return Response.json({ok,outcomes,predictionsChanged:false},{status:ok?200:502});
    } catch (error) {
      console.error('dividends-refresh',error);
      return Response.json({ok:false,error:'official-dividend-refresh-failed'},{status:502});
    }
  } } },
});