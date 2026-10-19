import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { isConfirmedComplete, resultsDueAt } from '@/lib/racing-results-schedule';
import { z } from 'zod';

export const Route = createFileRoute('/api/public/jobs/racing-results')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = z.object({ kind: z.literal('completion-check') }).strict().safeParse(await request.json().catch(() => null));
        if (!body.success) return Response.json({ ok: false, error: 'invalid-body' }, { status: 400 });
        const { readOfficialResultMeetings } = await import('@/lib/racing-results-official.server');
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { sendTelegramAlert } = await import('@/lib/telegramAlert.server');
        try {
          const now = new Date();
          const today = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
          const yesterday = new Date(now.getTime() + 8 * 3600_000 - 86400_000).toISOString().slice(0, 10);
          const { meetings, sha256 } = await readOfficialResultMeetings();
          const { collectOfficialRace } = await import('@/lib/hkjc-results-collector.server');
          const candidates = meetings.filter(m => [today, yesterday].includes(m.date) && ['ST','HV'].includes(m.venueCode));
          let liveResult: { raceNumber: number; action: string; sha256?: string } | null = null;
          for (const m of candidates) {
            const archived = await supabaseAdmin.from('racing_official_result_snapshots').select('race_number').eq('race_date',m.date).eq('venue',m.venueCode).eq('identity_verified',true);
            if (archived.error) throw new Error('official-archive-index-failed');
            const completed = new Set(archived.data?.map(r=>r.race_number));
            const next = m.races.filter(r=>r.status==='RESULT' && !completed.has(Number(r.no))).sort((a,b)=>Number(a.no)-Number(b.no))[0];
            if (next) { liveResult = await collectOfficialRace(m.date,m.venueCode,Number(next.no)); break; }
          }
          const complete = meetings.filter(m => [today, yesterday].includes(m.date) && isConfirmedComplete(m));
          const outcomes: { date: string; action: string }[] = [];
          for (const m of complete) {
            const inserted = await supabaseAdmin.from('racing_result_collection_state').upsert({
              race_date: m.date, venue: m.venueCode, first_confirmed_at: now.toISOString(), source_sha256: sha256, expected_races: m.totalNumberOfRace,
            }, { onConflict: 'race_date,venue', ignoreDuplicates: true });
            if (inserted.error) throw new Error('state-insert-failed');
            const stateRead = await supabaseAdmin.from('racing_result_collection_state').select('*').eq('race_date', m.date).eq('venue', m.venueCode).single();
            if (stateRead.error || !stateRead.data) throw new Error('state-read-failed');
            const state = stateRead.data;
            if (now.getTime() < resultsDueAt(state.first_confirmed_at)) { outcomes.push({ date: m.date, action: 'waiting-30-minutes' }); continue; }
            if (state.dispatched_at) { outcomes.push({ date: m.date, action: 'already-dispatched-not-delivery-proof' }); continue; }
            // Atomic lease prevents parallel callbacks dispatching the same meeting.
            const cutoff = new Date(now.getTime() - 10 * 60_000).toISOString();
            const claim = await supabaseAdmin.from('racing_result_collection_state').update({ last_attempt_at: now.toISOString() })
              .eq('race_date', m.date).eq('venue', m.venueCode).is('dispatched_at', null)
              .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`).select('race_date');
            if (claim.error) throw new Error('state-claim-failed');
            if (!claim.data?.length) { outcomes.push({ date: m.date, action: 'retry-lease-active' }); continue; }
            const token = process.env['GITHUB_TOKEN'];
            if (!token) throw new Error('missing-dispatch-token');
            const response = await fetch('https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/capy_race_daily.yml/dispatches', {
              method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-web', 'content-type': 'application/json' },
              body: JSON.stringify({ ref: 'main', inputs: { date: m.date, force: 'n' } }), signal: AbortSignal.timeout(4000),
            });
            if (response.status !== 204) throw new Error(`dispatch-${response.status}`);
            const saved = await supabaseAdmin.from('racing_result_collection_state').update({ dispatched_at: now.toISOString() }).eq('race_date', m.date).eq('venue', m.venueCode);
            if (saved.error) throw new Error('dispatch-state-save-failed');
            outcomes.push({ date: m.date, action: 'dispatched-not-delivery-proof' });
          }
          return Response.json({ ok: true, outcomes, liveResult, raceResultCollectionIndependent: true, independentExecution: false });
        } catch (error) {
          console.error('official-results-collection', error instanceof Error ? error.message : 'unknown-failure');
          await sendTelegramAlert('⚠️ 全日完場後賽果收料核對／觸發失敗；未確認完成，原凍結不改，請核對後備收料。').catch(() => null);
          return Response.json({ ok: false, error: 'results-collection-check-failed' }, { status: 502 });
        }
      },
    },
  },
});