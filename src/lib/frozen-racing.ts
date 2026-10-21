import { isTimeoutError } from './fetch-timeout';
export const frozenColumns = ['date','race_number','horse_id','engine','variant','horse_number','draw','horse_elo','elo_source','elo_confidence','elo_composite','factor_bonus','final_score','p_win','p_top3','predicted_rank','generated_at','lgb_score','lgb_model_version','score_source','jockey_elo','trainer_elo','factor_scores','pace_estimate'] as const;
export type FrozenRow = { [K in typeof frozenColumns[number] | 'raceId' | 'raceNumber' | 'startTime' | 'title' | 'class' | 'distance' | 'going' | 'track' | 'course' | 'horseId' | 'horseNumber' | 'finishingPosition' | 'winOdds' | 'runningPosition' | 'nameCh' | 'nameEn' | 'config']?: any };
function canonical(value: any): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
export async function validateFrozenSnapshot(saved: { snapshot_json: string; sha256: string }, date: string, current: FrozenRow[], meta: FrozenRow | null, now = Date.now()) {
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(saved.snapshot_json)))).map(n => n.toString(16).padStart(2,'0')).join('');
  if (hash !== saved.sha256) throw new Error('原始副本指紋不一致');
  const s = JSON.parse(saved.snapshot_json);
  if (s.schema !== 1 || s.date !== date || s.engine !== 'v12' || !['ST','HV'].includes(s.venue) || !Number.isFinite(Date.parse(s.lockAt)) || now < Date.parse(s.lockAt)) throw new Error('凍結身份或鎖點未能核實');
  if (!Array.isArray(s.rows) || !s.rows.length || canonical(meta) !== canonical(s.meta)) throw new Error('凍結描述未能核實');
  const races = new Map<number, FrozenRow[]>();
  for (const r of s.rows as FrozenRow[]) {
    if (r.date !== date || r.engine !== 'v12' || r.variant !== 'baseline' || !r.horse_id || !Number.isInteger(r.race_number) || r.race_number < 1 || !Number.isInteger(r.predicted_rank) || r.predicted_rank < 1 || !Number.isInteger(r.horse_number) || r.horse_number < 1 || !Number.isFinite(r.final_score) || !Number.isFinite(Date.parse(r.generated_at)) || Date.parse(r.generated_at) > Date.parse(s.lockAt)) throw new Error('凍結行不完整');
    const list = races.get(r.race_number) ?? []; list.push(r); races.set(r.race_number,list);
  }
  for (const list of races.values()) {
    if (list.length < 4 || new Set(list.map(r=>r.horse_id)).size !== list.length || new Set(list.map(r=>r.horse_number)).size !== list.length || new Set(list.map(r=>r.predicted_rank)).size !== list.length || list.some(r=>r.predicted_rank > list.length)) throw new Error('凍結場次不完整');
  }
  const key = (r: FrozenRow) => `${r.race_number}:${r.horse_id}`;
  const index = new Map(current.map(r=>[key(r),r]));
  if (current.length !== s.rows.length || index.size !== current.length) throw new Error('凍結行數不一致');
  for (const r of s.rows as FrozenRow[]) {
    const actual = index.get(key(r));
    if (!actual || frozenColumns.some(c => (actual[c] ?? null) !== (r[c] ?? null))) throw new Error('凍結預測與副本不一致');
  }
  return s as { schema: number; date: string; engine: string; venue: string; lockAt: string; rows: FrozenRow[]; meta: FrozenRow };
}

/** 凍結存證狀態：缺副本同核實失敗係兩件事，不可混為「載入失敗」。 */
export type FrozenEvidenceCode = 'available' | 'no-archive' | 'not-verified' | 'verification-failed' | 'read-failed';
export type FrozenEvidenceStatus = Exclude<FrozenEvidenceCode, 'verification-failed' | 'read-failed'>;

export function frozenEvidenceStatus(saved: { ok: number | null } | undefined | null): FrozenEvidenceStatus {
  if (!saved) return 'no-archive';
  return saved.ok === 1 ? 'available' : 'not-verified';
}

export class FrozenEvidenceError extends Error {
  readonly code: FrozenEvidenceCode;
  constructor(code: FrozenEvidenceCode, message: string) {
    super(message);
    this.name = 'FrozenEvidenceError';
    this.code = code;
  }
}

/**
 * 只有明確拋出嘅存證錯誤先帶原因碼；其他錯誤（網絡、逾時、429／5xx、資料服務讀唔齊）
 * 一律係「讀取失敗」read-failed，唔可以冒稱「核實未通過」。兩者都 fail-closed，唔展示預測。
 */
export function frozenEvidenceCodeOf(error: unknown): FrozenEvidenceCode {
  return error instanceof FrozenEvidenceError ? error.code : 'read-failed';
}

/** 公開 API 狀態碼：無副本 404；讀取失敗 502／504；未核實或核實失敗 503。 */
export function frozenEvidenceHttpStatus(code: FrozenEvidenceCode, error?: unknown): number {
  if (code === 'no-archive') return 404;
  if (code === 'read-failed') return isTimeoutError(error) ? 504 : 502;
  if (code === 'available') return 200;
  return 503;
}