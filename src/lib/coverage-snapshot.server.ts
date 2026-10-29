import type { readCoverageAudit } from './coverage-audit.server';
type CoverageSnapshot = Awaited<ReturnType<typeof readCoverageAudit>>;

/** Read the last complete job-produced audit; visitors never rebuild it. */
export async function readStoredCoverageAudit(days: number): Promise<CoverageSnapshot> {
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data, error } = await supabaseAdmin.from('computed_cache').select('payload').eq('key', `coverage:original-v5:${days}`).maybeSingle();
  const value = data?.payload as unknown as CoverageSnapshot | undefined;
  if (error || !value || !Array.isArray(value.rows) || !Array.isArray(value.meetings) || !Array.isArray(value.failed) || value.failed.length || !Array.isArray(value.missingOdds) || value.missingOdds.length || !Number.isFinite(Date.parse(value.checkedAt))) {
    throw new Error('分層對帳完整紀錄暫未能讀取，請稍後重試');
  }
  return value;
}