import { publicRacingQuery as query } from './public-racing-evidence.server';

/**
 * 只讀目錄：邊個賽日有「已核實嘅原始凍結副本」（副本存在且 prediction_recovery_status.ok=1）。
 * 呢份清單只反映存證存在與否，絕不代表該日戰績已驗收；缺副本嘅賽日不可用重算補寫。
 */
export async function readVerifiedFrozenDates(limit = 60): Promise<string[]> {
  const rows = await query<{ date: string }>(
    `SELECT s.date FROM prediction_original_snapshots s JOIN prediction_recovery_status p ON p.date=s.date AND p.engine=s.engine WHERE p.ok=1 ORDER BY s.date DESC LIMIT ?`,
    [limit],
  );
  return [...new Set(rows.map(r => r.date).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(String(d))))];
}
