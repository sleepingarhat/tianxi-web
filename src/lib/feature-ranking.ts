import type { FeatureId, Horse } from "./race-data";

export type FeatureRow = {
  rank: number;
  horse: Horse;
  metric: string;
  win: number;
  place: number;
  score: number;
};

/** 單一特徵排序表：按該特徵分數由高至低。 */
export function rankByFeature(horses: Horse[], feature: FeatureId): FeatureRow[] {
  return horses
    .map((horse) => {
      const stat = horse.stats[feature];
      return { horse, metric: stat.metric, win: stat.win, place: stat.place, score: stat.score };
    })
    .sort((a, b) => b.score - a.score)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

export type CompositeRow = {
  rank: number;
  horse: Horse;
  /** 綜合分數（所選特徵平均分，0-100） */
  composite: number;
  /** 所選特徵各自的名次 */
  ranks: Record<string, number>;
  /** 排第一的特徵數目 */
  leads: number;
  /** 在所選特徵中的平均名次 */
  avgRank: number;
  win: number;
  place: number;
};

/**
 * 綜合特徵排序：用戶只需選任意數量的特徵（例如十個之中揀四個），
 * 亦可運算出綜合排序。每匹馬的綜合分 = 所選特徵分數平均值。
 */
export function computeComposite(horses: Horse[], selected: FeatureId[]): CompositeRow[] {
  if (selected.length === 0) return [];

  const rankLookup = new Map<FeatureId, Map<number, number>>();
  for (const feature of selected) {
    const table = rankByFeature(horses, feature);
    rankLookup.set(feature, new Map(table.map((row) => [row.horse.no, row.rank])));
  }

  return horses
    .map((horse) => {
      const scores = selected.map((f) => horse.stats[f].score);
      const composite = scores.reduce((a, b) => a + b, 0) / selected.length;
      const ranks: Record<string, number> = {};
      let leads = 0;
      let rankSum = 0;
      for (const feature of selected) {
        const r = rankLookup.get(feature)!.get(horse.no) ?? horses.length;
        ranks[feature] = r;
        rankSum += r;
        if (r === 1) leads += 1;
      }
      const withPct = selected.filter((f) => horse.stats[f].win > 0);
      const avg = (pick: (f: FeatureId) => number) =>
        withPct.length ? withPct.reduce((a, f) => a + pick(f), 0) / withPct.length : 0;

      return {
        horse,
        composite,
        ranks,
        leads,
        avgRank: rankSum / selected.length,
        win: avg((f) => horse.stats[f].win),
        place: avg((f) => horse.stats[f].place),
      };
    })
    .sort((a, b) => b.composite - a.composite)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}


export type FeatureWeightSpec = {
  id: FeatureId;
  /** 0–3, step 0.5；0＝唔用 */
  weight: number;
  /** 反向：用 100−score */
  invert?: boolean;
};

function clampWeight(w: number): number {
  if (!Number.isFinite(w)) return 0;
  const stepped = Math.round(w * 2) / 2;
  return Math.max(0, Math.min(3, stepped));
}

/** 加權綜合分（即場重排）；權重 0 嘅特徵忽略。 */
export function computeWeightedComposite(
  horses: Horse[],
  weights: FeatureWeightSpec[],
): CompositeRow[] {
  const active = weights
    .map((w) => ({ ...w, weight: clampWeight(w.weight) }))
    .filter((w) => w.weight > 0);
  if (!active.length) return [];

  const selected = active.map((w) => w.id);
  const rankLookup = new Map<FeatureId, Map<number, number>>();
  for (const feature of selected) {
    const table = rankByFeature(horses, feature);
    rankLookup.set(feature, new Map(table.map((row) => [row.horse.no, row.rank])));
  }

  return horses
    .map((horse) => {
      let sum = 0;
      let wSum = 0;
      for (const w of active) {
        const raw = horse.stats[w.id]?.score;
        if (raw == null || !Number.isFinite(raw)) continue;
        const v = w.invert ? 100 - raw : raw;
        sum += v * w.weight;
        wSum += w.weight;
      }
      const composite = wSum > 0 ? sum / wSum : 0;
      const ranks: Record<string, number> = {};
      let leads = 0;
      let rankSum = 0;
      for (const feature of selected) {
        const r = rankLookup.get(feature)!.get(horse.no) ?? horses.length;
        ranks[feature] = r;
        rankSum += r;
        if (r === 1) leads += 1;
      }
      const withPct = selected.filter((f) => horse.stats[f].win > 0);
      const avg = (pick: (f: FeatureId) => number) =>
        withPct.length ? withPct.reduce((a, f) => a + pick(f), 0) / withPct.length : 0;

      return {
        horse,
        composite,
        ranks,
        leads,
        avgRank: rankSum / selected.length,
        win: avg((f) => horse.stats[f].win),
        place: avg((f) => horse.stats[f].place),
      };
    })
    .sort((a, b) => b.composite - a.composite)
    .map((row, i) => ({ ...row, rank: i + 1 }));
}
