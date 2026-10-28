import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { isConfirmedComplete, resultsDueAt } from '@/lib/racing-results-schedule';
import { racingResultsJobInput } from '@/lib/racing-results-job-input';

export const Route = createFileRoute('/api/public/jobs/racing-results')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        const body = racingResultsJobInput.safeParse(await request.json().catch(() => null));
        if (!body.success) return Response.json({ ok: false, error: 'invalid-body' }, { status: 400 });
        const { readOfficialResultMeetings } = await import('@/lib/racing-results-official.server');
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
        const { sendTelegramAlert } = await import('@/lib/telegramAlert.server');
        const { alertOnce, collectPendingRaces, raceFailureAlertKey, raceFailureAlertText, resultErrorCode, raceStartTimingMap, suppressMeetingTimeoutAlert, suppressRaceFailureAlert, workerMeetingTimingMap } = await import('@/lib/racing-results-failures');
        const alertStore = {
          read: async (key: string) => {
            const r = await supabaseAdmin.from('telegram_alert_state').select('value').eq('key', key).maybeSingle();
            if (r.error) throw new Error('alert-state-unreadable');
            return (r.data?.value ?? null) as { sentAt?: string } | null;
          },
          write: async (key: string, value: Record<string, unknown>) => {
            const r = await supabaseAdmin.from('telegram_alert_state').upsert({ key, value: value as never });
            if (r.error) throw new Error('alert-state-save-failed');
          },
          send: sendTelegramAlert,
        };
        try {
          if (body.data.kind === 'archive-backfill') {
            const { date, venue, raceNumber } = body.data;
            const todayHkt = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
            if (date > todayHkt) return Response.json({ ok: false, error: 'future-result-date' }, { status: 400 });
            const { collectOfficialRace } = await import('@/lib/hkjc-results-collector.server');
            const result = await collectOfficialRace(date, venue, raceNumber);
            return Response.json({ ok: true, date, venue, result, predictionsChanged: false });
          }
          const now = new Date();
          const today = new Date(now.getTime() + 8 * 3600_000).toISOString().slice(0, 10);
          const yesterday = new Date(now.getTime() + 8 * 3600_000 - 86400_000).toISOString().slice(0, 10);
          const { meetings, sha256 } = await readOfficialResultMeetings();
          const { collectOfficialRace } = await import('@/lib/hkjc-results-collector.server');
          const candidates = meetings.filter(m => [today, yesterday].includes(m.date) && ['ST','HV'].includes(m.venueCode));
          // Best-effort race start times for alert-noise control. D1 races rows
          // only exist after results ingest, so pre-race the map falls back to
          // the Worker's public meeting projection. Unknown timing never
          // suppresses an alert.
          const startedMaps = new Map<string, ReadonlyMap<number, number> | null>();
          {
            const { publicRacingQuery } = await import('@/lib/public-racing-evidence.server');
            const { workerFetch, WORKER_BASE } = await import('@/lib/site-reader.server');
            for (const m of candidates) {
              let timing: ReadonlyMap<number, number> | null = null;
              try {
                const rows = await publicRacingQuery<{ raceNumber: number; startTime: string | null }>(`SELECT r.race_number raceNumber,r.start_time startTime FROM races r JOIN race_meetings mt ON mt.id=r.meeting_id WHERE mt.date=? AND mt.venue=?`, [m.date, m.venueCode]);
                timing = raceStartTimingMap(rows, m.date);
              } catch { /* fall through to the Worker projection */ }
              if (!timing) {
                try {
                  const res = await workerFetch(`${WORKER_BASE}/api/meetings/${m.date}`, { signal: AbortSignal.timeout(9000) });
                  if (res.ok) timing = workerMeetingTimingMap(await res.json(), m.date, m.venueCode);
                } catch { /* timing unknown → never suppress */ }
              }
              startedMaps.set(`${m.date}:${m.venueCode}`, timing);
            }
          }
          let liveResult: { raceNumber: number; action: string; sha256?: string } | null = null;
          const raceFailures: { date: string; venue: string; raceNumber: number; code: string }[] = [];
          const meetingFailures: { date: string; venue: string; code: string }[] = [];
          for (const m of candidates) {
            if (liveResult) break;
            try {
              const archived = await supabaseAdmin.from('racing_official_result_snapshots').select('race_number').eq('race_date',m.date).eq('venue',m.venueCode).eq('identity_verified',true);
              if (archived.error) throw new Error('official-archive-index-failed');
              const completed = new Set(archived.data?.map(r=>r.race_number));
              const pending = m.races.filter(r=>r.status==='RESULT' && !completed.has(Number(r.no))).map(r=>Number(r.no));
              // A race that fails is recorded and skipped; later races still collect. It stays
              // unarchived, so delivery for this meeting can never be marked verified.
              const live = await collectPendingRaces(m.date, m.venueCode, pending, n => collectOfficialRace(m.date, m.venueCode, n));
              raceFailures.push(...live.failures);
              if (live.archived) liveResult = live.archived;
            } catch (error) {
              meetingFailures.push({ date: m.date, venue: m.venueCode, code: resultErrorCode(error) });
            }
          }
          const complete = meetings.filter(m => [today, yesterday].includes(m.date) && isConfirmedComplete(m));
          const outcomes: { date: string; action: string; raceFailures?: number[] }[] = [];
          for (const m of complete) {
            const failedRaces = raceFailures.filter(f => f.date === m.date && f.venue === m.venueCode).map(f => f.raceNumber);
            const withFailures = failedRaces.length ? { raceFailures: failedRaces } : {};
            try {
              const inserted = await supabaseAdmin.from('racing_result_collection_state').upsert({
                race_date: m.date, venue: m.venueCode, first_confirmed_at: now.toISOString(), source_sha256: sha256, expected_races: m.totalNumberOfRace,
              }, { onConflict: 'race_date,venue', ignoreDuplicates: true });
              if (inserted.error) throw new Error('state-insert-failed');
              const stateRead = await supabaseAdmin.from('racing_result_collection_state').select('*').eq('race_date', m.date).eq('venue', m.venueCode).single();
              if (stateRead.error || !stateRead.data) throw new Error('state-read-failed');
              const state = stateRead.data;
              if (now.getTime() < resultsDueAt(state.first_confirmed_at)) { outcomes.push({ date: m.date, action: 'waiting-30-minutes', ...withFailures }); continue; }
              if (state.dispatched_at) {
                const { checkResultsDelivery } = await import('@/lib/results-delivery.server');
                // Verification requires every expected race archived, so a failed race keeps this unverified.
                const delivery = await checkResultsDelivery(m.date, m.venueCode, state.expected_races);
                outcomes.push({ date: m.date, action: delivery.action, ...withFailures }); continue;
              }
              // Atomic lease prevents parallel callbacks dispatching the same meeting.
              const cutoff = new Date(now.getTime() - 10 * 60_000).toISOString();
              const claim = await supabaseAdmin.from('racing_result_collection_state').update({ last_attempt_at: now.toISOString() })
                .eq('race_date', m.date).eq('venue', m.venueCode).is('dispatched_at', null)
                .or(`last_attempt_at.is.null,last_attempt_at.lt.${cutoff}`).select('race_date');
              if (claim.error) throw new Error('state-claim-failed');
              if (!claim.data?.length) { outcomes.push({ date: m.date, action: 'retry-lease-active', ...withFailures }); continue; }
              const token = process.env['GITHUB_TOKEN'];
              if (!token) throw new Error('missing-dispatch-token');
              const response = await fetch('https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/workflows/capy_race_daily.yml/dispatches', {
                method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-web', 'content-type': 'application/json' },
                body: JSON.stringify({ ref: 'main', inputs: { date: m.date, force: 'n' }, return_run_details: true }), signal: AbortSignal.timeout(30_000),
              });
              if (response.status !== 200 && response.status !== 204) throw new Error(`dispatch-${response.status}`);
              const details = response.status === 200 ? await response.json() as { workflow_run_id?: unknown } : null;
              const runId = details?.workflow_run_id;
              const tracked = await supabaseAdmin.from('telegram_alert_state').upsert({ key: `results-delivery:${m.date}:${m.venueCode}`, value: { dispatchedAt: now.toISOString(), ...(typeof runId === 'number' && Number.isInteger(runId) && runId > 0 ? { runId } : {}) } });
              if (tracked.error) throw new Error('dispatch-run-state-save-failed');
              const saved = await supabaseAdmin.from('racing_result_collection_state').update({ dispatched_at: now.toISOString() }).eq('race_date', m.date).eq('venue', m.venueCode);
              if (saved.error) throw new Error('dispatch-state-save-failed');
              outcomes.push({ date: m.date, action: typeof runId === 'number' ? 'own-run-accepted-not-delivery-proof' : 'dispatched-run-id-unverified', ...withFailures });
            } catch (error) {
              meetingFailures.push({ date: m.date, venue: m.venueCode, code: resultErrorCode(error) });
            }
          }
          for (const f of raceFailures) {
            console.error('official-results-race', f.date, f.venue, f.raceNumber, f.code);
            if (suppressRaceFailureAlert(f, startedMaps.get(`${f.date}:${f.venue}`) ?? null, now)) continue;
            await alertOnce(raceFailureAlertKey(f), raceFailureAlertText(f), alertStore);
          }
          for (const f of meetingFailures) {
            console.error('official-results-meeting', f.date, f.venue, f.code);
            // Before race 1 no result can exist; a status-query timeout then is noise.
            if (suppressMeetingTimeoutAlert(f.code, startedMaps.get(`${f.date}:${f.venue}`) ?? null, now)) continue;
            await alertOnce(`results-meeting-failure:${f.date}:${f.venue}:${f.code}`,
              `⚠️ 全日完場後賽果收料核對／觸發失敗：${f.date} ${f.venue}（${f.code}）；未確認完成，原凍結不改，請核對後備收料。`, alertStore);
          }
          const payload = { outcomes, liveResult, raceFailures, meetingFailures, raceResultCollectionIndependent: true, independentExecution: false };
          if (meetingFailures.length) return Response.json({ ok: false, error: 'results-collection-check-failed', ...payload }, { status: 502 });
          return Response.json({ ok: true, degraded: raceFailures.length > 0, ...payload });
        } catch (error) {
          const code = resultErrorCode(error);
          console.error('official-results-collection', code);
          if (body.data.kind === 'archive-backfill') {
            await sendTelegramAlert(`⚠️ 歷史賽果補收未完成：${body.data.date} ${body.data.venue} 第${body.data.raceNumber}場（${code}）；不涉及今日凍結，原預測及戰績不改。`).catch(() => null);
          } else {
            const hktDay = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
            // Before race 1 starts, a status-query timeout is expected noise, not an incident.
            let skipTimeoutAlert = false;
            if (code === 'official-result-timeout') {
              try {
                const { publicRacingQuery } = await import('@/lib/public-racing-evidence.server');
                const rows = await publicRacingQuery<{ raceNumber: number; startTime: string | null }>(`SELECT r.race_number raceNumber,r.start_time startTime FROM races r JOIN race_meetings m ON m.id=r.meeting_id WHERE m.date=?`, [hktDay]);
                skipTimeoutAlert = suppressMeetingTimeoutAlert(code, raceStartTimingMap(rows, hktDay));
              } catch { /* timing unknown → alert as before */ }
            }
            if (!skipTimeoutAlert) await alertOnce(`results-job-failure:${hktDay}:${code}`, `⚠️ 全日完場後賽果收料核對／觸發失敗（${code}）；未確認完成，原凍結不改，請核對後備收料。`, alertStore);
          }
          return Response.json({ ok: false, error: 'results-collection-check-failed', code }, { status: 502 });
        }
      },
    },
  },
});