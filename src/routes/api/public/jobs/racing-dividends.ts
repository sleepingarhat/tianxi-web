import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { isConfirmedComplete } from '@/lib/racing-results-schedule';
import { dividendJobError, retryDividendMeeting, updateDividendAlert, type DividendAlertStore } from '@/lib/racing-dividends-job';
import { isLocalVenue, jobTickKey, makeJobTick } from '@/lib/job-ticks';

export const Route = createFileRoute('/api/public/jobs/racing-dividends')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const body = await request.json().catch(() => null);
    if (body?.kind !== 'refresh' || Object.keys(body).length !== 1) return Response.json({ error: 'invalid-body' }, { status: 400 });
    const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
    const alertStore: DividendAlertStore = {
      read: async key => {
        const r = await supabaseAdmin.from('telegram_alert_state').select('value').eq('key', key).maybeSingle();
        if (r.error) throw new Error('alert-state-unreadable');
        return r.data?.value ?? null;
      },
      write: async (key, state) => {
        const r = await supabaseAdmin.from('telegram_alert_state').upsert({ key, value: { ...state } });
        if (r.error) throw new Error('alert-state-save-failed');
      },
      send: async text => {
        const { sendTelegramAlert } = await import('@/lib/telegramAlert.server');
        return sendTelegramAlert(text);
      },
    };
    try {
      const index = await supabaseAdmin.from('racing_result_collection_state').select('race_date,venue,expected_races').order('race_date',{ascending:false}).limit(2);
      if (index.error) throw new Error('dividend-meeting-index-failed');
      const meetings = new Map<string,{date:string;venue:string;count:number}>();
      for (const r of index.data ?? []) {
        // jeffincn LOCAL_VENUES — skip overseas S1–S5; HTML path already skips 海外賽事.
        if (!isLocalVenue(r.venue)) continue;
        const key = `${r.race_date}:${r.venue}`;
        const m = meetings.get(key) ?? {date:r.race_date,venue:r.venue,count:0};
        m.count = r.expected_races; meetings.set(key,m);
      }
      const { readOfficialResultMeetings } = await import('@/lib/racing-results-official.server');
      const official = await readOfficialResultMeetings();
      for (const m of official.meetings.filter(isConfirmedComplete)) {
        if (!isLocalVenue(m.venueCode)) continue;
        meetings.set(`${m.date}:${m.venueCode}`,{date:m.date,venue:m.venueCode,count:m.totalNumberOfRace});
      }
      const { collectOfficialDividends } = await import('@/lib/hkjc-dividends.server');
      const outcomes = await Promise.all([...meetings.values()].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,2).map(async m => {
        const outcome = await retryDividendMeeting(() => collectOfficialDividends(m.date,m.venue,m.count));
        const key = `dividends:${m.date}:${m.venue}`;
        if (outcome.ok) {
          const r = outcome.result;
          await updateDividendAlert(alertStore, key, { ok: true, recovery: `✅ 官方派彩自動核對已恢復：${m.date} ${m.venue}，${r.rows} 行／${r.raceCount} 場，SHA ${r.sha256.slice(0,8)}` });
          return {ok:true,...r,attempts:outcome.attempts};
        }
        await updateDividendAlert(alertStore, key, { ok: false, error: outcome.error, warning: `⚠️ 官方派彩自動核對未齊：${m.date}（${outcome.error}）；保留上次存證，五分鐘後自動重試。` });
        return {ok:false,date:m.date,error:outcome.error,attempts:outcome.attempts};
      }));
      const ok = outcomes.length > 0 && outcomes.every(o=>o.ok);
      // The outer job recovered once index/discovery/collection completed, even if a meeting failed.
      await updateDividendAlert(alertStore, 'dividends:job', { ok: true, recovery: '✅ 官方派彩自動核對工作已恢復' });
      // Dead-man tick — orthogonal to source_sha256 content-hash dedupe.
      const tick = makeJobTick('racing-dividends', ok ? 'ok' : 'fail', {
        meetings: outcomes.length,
        okCount: outcomes.filter(o => o.ok).length,
      });
      const tickWrite = await supabaseAdmin.from('telegram_alert_state').upsert({ key: jobTickKey('racing-dividends'), value: tick });
      if (tickWrite.error) console.error('job-tick-write', tickWrite.error);
      return Response.json({ok,outcomes,predictionsChanged:false,jobTick:tick},{status:ok?200:502});
    } catch (error) {
      console.error('dividends-refresh',error);
      const code = dividendJobError(error);
      await updateDividendAlert(alertStore, 'dividends:job', { ok: false, error: code, warning: `⚠️ 官方派彩自動核對工作失敗（${code}）` });
      const failTick = makeJobTick('racing-dividends', 'fail', { error: code });
      await supabaseAdmin.from('telegram_alert_state').upsert({ key: jobTickKey('racing-dividends'), value: failTick });
      return Response.json({ok:false,outcomes:[],predictionsChanged:false,error:'official-dividend-refresh-failed',jobTick:failTick},{status:502});
    }
  } } },
});