import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as string[],
  rows: [] as Record<string, unknown>[],
  saved: null as { snapshot_json: string; sha256: string; captured_at: string; ok: number } | null,
  meta: null as Record<string, unknown> | null,
  results: [] as Record<string, unknown>[],
  resultsError: null as Error | null,
  snapshotError: null as Error | null,
}));

vi.mock('./public-racing-evidence.server', () => ({
  publicRacingQuery: async (sql: string) => {
    state.calls.push(sql);
    if (sql.includes('prediction_original_snapshots')) {
      if (state.snapshotError) throw state.snapshotError;
      return state.saved ? [state.saved] : [];
    }
    if (sql.includes('prediction_lock_meta')) return state.meta ? [state.meta] : [];
    if (sql.includes('FROM races r')) return [{ raceNumber: 1, raceId: 'race_2026-10-19_ST_1', startTime: '13:00', title: '第一場', class: '第五班', distance: 1200, going: '好地', track: '草地', course: 'A' }];
    if (sql.includes('race_results')) {
      if (state.resultsError) throw state.resultsError;
      return state.results;
    }
    if (sql.includes('GROUP BY race_number')) return [];
    if (sql.includes('JOIN prediction_log')) return state.rows.map(row => ({ horseId: row['horse_id'], nameCh: '測試馬', nameEn: 'Test' }));
    if (sql.includes('FROM prediction_log')) return state.rows;
    if (sql.includes('WHERE id IN')) return [];
    if (sql.includes('entries_upcoming')) return state.rows.map(row => ({ raceNumber: row['race_number'], horseNumber: row['horse_number'], horseId: row['horse_id'] }));
    throw new Error(`unexpected sql ${sql.slice(0, 80)}`);
  },
}));
vi.mock('./hkjc-results-collector.server', () => ({ readCloudOfficialResults: async () => [] }));
vi.mock('./hkjc-changes.server', () => ({ readLatestHkjcChanges: async () => null }));

import { clearVerifiedFreezeCache, readFrozenRacing } from './frozen-racing.server';

const DATE = '2026-10-19';
const calls = (part: string) => state.calls.filter(sql => sql.includes(part)).length;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T06:00:00Z'));
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ venue: 'ST', trackCondition: '好地', races: [] })));
  clearVerifiedFreezeCache();
  state.calls = [];
  state.results = [];
  state.resultsError = null;
  state.snapshotError = null;
  const rows = Array.from({ length: 4 }, (_, i) => ({
    date: DATE, engine: 'v12', variant: 'baseline', race_number: 1, horse_id: `horse_${i}`, horse_number: i + 1,
    predicted_rank: i + 1, final_score: 1600 - i, p_win: 0.2, p_top3: null, factor_bonus: 1, generated_at: '2026-10-19T00:48:21.522Z',
  }));
  const meta = { date: DATE, config: '{}' };
  const snapshot_json = JSON.stringify({ schema: 1, date: DATE, engine: 'v12', venue: 'ST', lockAt: '2026-10-19T03:00:00Z', rows, meta });
  const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(snapshot_json)))).map(n => n.toString(16).padStart(2, '0')).join('');
  state.rows = rows;
  state.meta = meta;
  state.saved = { snapshot_json, sha256, captured_at: '2026-10-19T02:50:00Z', ok: 1 };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function raceOf(body: { races: Array<{ predictedTop4: number[]; picks: Array<{ finalScore?: number; horseNumber?: number }>; results: unknown[]; resultsStatus: string; snapshot?: unknown }> } & { snapshot: { sha256: string } }) {
  const race = body.races[0];
  if (!race) throw new Error('missing race');
  return race;
}

describe('已核實凍結副本之後只重讀賽果', () => {
  it('第二次重用已核實副本，四揀同分同 SHA，賽果仍然更新', async () => {
    const first = await readFrozenRacing(DATE, { reuseVerified: true });
    expect(first.snapshot.sha256).toBe(state.saved?.sha256);
    expect(raceOf(first).predictedTop4).toEqual([1, 2, 3, 4]);
    expect(raceOf(first).picks[0]?.finalScore).toBe(1600);
    expect(raceOf(first).resultsStatus).toBe('pending');
    state.rows = state.rows.map(row => ({ ...row, final_score: 9999 }));
    state.calls = [];
    state.results = [{ raceNumber: 1, horseId: 'horse_0', horseNumber: 1, finishingPosition: 1, winOdds: 3.5, runningPosition: null }];
    const polled = await readFrozenRacing(DATE, { reuseVerified: true });
    expect(calls('prediction_original_snapshots')).toBe(0);
    expect(calls('FROM prediction_log')).toBe(0);
    expect(calls('race_results')).toBe(1);
    expect(polled.snapshot.sha256).toBe(first.snapshot.sha256);
    expect(raceOf(polled).predictedTop4).toEqual([1, 2, 3, 4]);
    expect(raceOf(polled).picks[0]?.finalScore).toBe(1600);
    expect(raceOf(polled).resultsStatus).toBe('available');
    expect(raceOf(polled).results).toHaveLength(1);
  });
  it('公開讀取每次都再驗證，手動重新核對亦然', async () => {
    await readFrozenRacing(DATE, { reuseVerified: true });
    state.calls = [];
    await readFrozenRacing(DATE);
    expect(calls('prediction_original_snapshots')).toBe(1);
    state.calls = [];
    await readFrozenRacing(DATE, { verify: true, reuseVerified: true });
    expect(calls('prediction_original_snapshots')).toBe(1);
    expect(calls('race_results')).toBe(1);
  });
  it('賽果讀取 429 唔會丟掉已核實副本，亦唔會改四揀', async () => {
    await readFrozenRacing(DATE, { reuseVerified: true });
    state.resultsError = new Error('資料服務繁忙，請稍後再試');
    await expect(readFrozenRacing(DATE, { reuseVerified: true })).rejects.toThrow('資料服務繁忙，請稍後再試');
    state.resultsError = null;
    state.rows = state.rows.map(row => ({ ...row, final_score: 1 }));
    state.calls = [];
    const again = await readFrozenRacing(DATE, { reuseVerified: true });
    expect(calls('prediction_original_snapshots')).toBe(0);
    expect(raceOf(again).picks[0]?.finalScore).toBe(1600);
  });
  it('重新核實失敗就清掉快取，之後唔可以沿用舊四揀冒充新核實', async () => {
    await readFrozenRacing(DATE, { reuseVerified: true });
    const sha = state.saved?.sha256 ?? '';
    if (state.saved) state.saved = { ...state.saved, sha256: 'bad' };
    await expect(readFrozenRacing(DATE, { verify: true, reuseVerified: true })).rejects.toThrow('指紋');
    if (state.saved) state.saved = { ...state.saved, sha256: sha };
    state.calls = [];
    const again = await readFrozenRacing(DATE, { reuseVerified: true });
    expect(calls('prediction_original_snapshots')).toBe(1);
    expect(raceOf(again).picks[0]?.finalScore).toBe(1600);
  });
  it('未曾核實成功就唔會快取一次 429', async () => {
    state.snapshotError = new Error('資料服務繁忙，請稍後再試');
    await expect(readFrozenRacing(DATE, { reuseVerified: true })).rejects.toThrow('資料服務繁忙，請稍後再試');
    state.snapshotError = null;
    state.calls = [];
    await readFrozenRacing(DATE, { reuseVerified: true });
    expect(calls('prediction_original_snapshots')).toBe(1);
  });
  it('賽果身份不符會阻截，而且唔再沿用該次快取', async () => {
    await readFrozenRacing(DATE, { reuseVerified: true });
    state.results = [{ raceNumber: 1, horseId: 'horse_other', horseNumber: 9, finishingPosition: 1 }];
    await expect(readFrozenRacing(DATE, { reuseVerified: true })).rejects.toThrow('身份');
    state.results = [];
    state.calls = [];
    await readFrozenRacing(DATE, { reuseVerified: true });
    expect(calls('prediction_original_snapshots')).toBe(1);
  });
});
