/** Formal engine scoring uses immutable original selections, never display alternatives. */
export type OfficialMetricInput = {
  original: number[];
  effective: number[];
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
    alternativeHits: eligible && fourUnique(input.effective) ? input.effective.filter(n => actual.has(n)).length : null,
    includedInOfficialMetrics: eligible,
    alternativeIncludedInOfficialMetrics: false as const,
    hasWithdrawal: input.hasWithdrawal,
    postLockJockeyChange: input.postLockJockeyChange,
  };
}
export function summarizeOfficialMetrics(inputs: OfficialMetricInput[]) {
  const rows = inputs.map(officialRaceMetric).filter(r => r.eligible);
  const summarize = (xs: typeof rows) => {
    const hits = xs.reduce((n, r) => n + (r.originalHits ?? 0), 0);
    return { races: xs.length, originalHits: hits, originalAverage: xs.length ? hits / xs.length : null,
      alternativeHits: xs.reduce((n, r) => n + (r.alternativeHits ?? 0), 0), alternativeIncludedInOfficialMetrics: false as const };
  };
  return { ...summarize(rows), excluded: inputs.length - rows.length,
    groups: {
      unchanged: summarize(rows.filter(r => !r.hasWithdrawal && !r.postLockJockeyChange)),
      'post-lock-withdrawal': summarize(rows.filter(r => r.hasWithdrawal)),
      'post-lock-jockey-change': summarize(rows.filter(r => r.postLockJockeyChange)),
    } };
}