/** 正式戰績只計原凍結四揀；鎖後退出馬當冇中，分母固定4，唔補位。 */
export type OfficialMetricInput = {
  original: number[];
  actualTop4: number[];
  status: string;
  hasWithdrawal: boolean;
  postLockJockeyChange: boolean;
};
const fourUnique = (ns: number[]) => ns.length === 4 && new Set(ns).size === 4 && ns.every(n => Number.isInteger(n) && n > 0);
export function officialRaceMetric(input: OfficialMetricInput) {
  const eligible = input.status === 'valid' && fourUnique(input.original) && fourUnique(input.actualTop4);
  const actual = new Set(input.actualTop4);
  return {
    eligible,
    originalHits: eligible ? input.original.filter(n => actual.has(n)).length : null,
    includedInOfficialMetrics: eligible,
    hasWithdrawal: input.hasWithdrawal,
    postLockJockeyChange: input.postLockJockeyChange,
  };
}
export function summarizeOfficialMetrics(inputs: OfficialMetricInput[]) {
  const rows = inputs.map(officialRaceMetric).filter(r => r.eligible);
  const summarize = (xs: typeof rows) => {
    const hits = xs.reduce((n, r) => n + (r.originalHits ?? 0), 0);
    return { races: xs.length, originalHits: hits, originalAverage: xs.length ? hits / xs.length : null };
  };
  return { ...summarize(rows), excluded: inputs.length - rows.length,
    groups: {
      unchanged: summarize(rows.filter(r => !r.hasWithdrawal && !r.postLockJockeyChange)),
      'post-lock-withdrawal': summarize(rows.filter(r => r.hasWithdrawal)),
      'post-lock-jockey-change': summarize(rows.filter(r => r.postLockJockeyChange)),
    } };
}
