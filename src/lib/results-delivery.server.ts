import { z } from 'zod';
import { resultsDeliveryVerified } from './results-delivery';

const stateSchema = z.object({ runId: z.number().int().positive().optional(), dispatchedAt: z.string().optional(), status: z.string().optional(), conclusion: z.string().nullable().optional(), verifiedAt: z.string().optional(), notified: z.boolean().optional() });

/** Existing five-minute callback checks only its own accepted run; never infers an ID by time. */
export async function checkResultsDelivery(date: string, venue: string, expected: number) {
  const { supabaseAdmin: sb } = await import('@/integrations/supabase/client.server');
  const key = `results-delivery:${date}:${venue}`;
  const read = await sb.from('telegram_alert_state').select('value').eq('key', key).maybeSingle();
  if (read.error) throw new Error('delivery-state-unreadable');
  const parsed = stateSchema.safeParse(read.data?.value ?? {});
  if (!parsed.success) throw new Error('delivery-state-invalid');
  const state = parsed.data;
  if (!state.runId) return { action: 'dispatched-run-id-unverified', deliveryVerified: false };
  const token = process.env['GITHUB_TOKEN'];
  if (!token) throw new Error('missing-dispatch-token');
  const response = await fetch(`https://api.github.com/repos/sleepingarhat/tianxi-racing/actions/runs/${state.runId}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'user-agent': 'tianxi-web' }, signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`own-run-status-${response.status}`);
  const run = z.object({ id: z.number().int().positive(), status: z.string(), conclusion: z.string().nullable(), path: z.string(), head_branch: z.string() }).parse(await response.json());
  if (run.id !== state.runId || run.head_branch !== 'main' || !run.path.endsWith('/capy_race_daily.yml')) throw new Error('own-run-identity-mismatch');
  const archives = await sb.from('racing_official_result_snapshots').select('race_number').eq('race_date', date).eq('venue', venue).eq('identity_verified', true);
  if (archives.error) throw new Error('delivery-archive-unreadable');
  const next = { ...state, status: run.status, conclusion: run.conclusion };
  const verified = resultsDeliveryVerified(next, archives.data?.map(r => r.race_number) ?? [], expected);
  if (verified) next.verifiedAt ??= new Date().toISOString();
  if (run.status === 'completed' && run.conclusion !== 'success' && !next.notified) {
    const { sendTelegramAlert } = await import('./telegramAlert.server');
    next.notified = (await sendTelegramAlert(`⚠️ ${date} ${venue} 全日賽果收料工作${state.runId}未成功（${run.conclusion ?? '未知'}）；交付未驗證，原凍結不改。`)).sent;
  }
  const saved = await sb.from('telegram_alert_state').upsert({ key, value: next });
  if (saved.error) throw new Error('delivery-state-save-failed');
  return { action: verified ? 'own-run-and-official-results-verified' : run.status === 'completed' && run.conclusion !== 'success' ? 'own-run-failed' : 'waiting-own-run-and-results', deliveryVerified: verified };
}