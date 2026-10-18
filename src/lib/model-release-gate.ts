/** Release evidence must describe the calibrated serving replay, not raw-margin sensitivity. */
export interface ReleaseEvidence {
  calibratedServingReplay: boolean;
  /** 39 rows: satisfied either by per-row original evidence OR by debut verification
   *  (2026-10-18: all 39 horses' first-ever race equals the missing-axis date, so no
   *  pre-race snapshot could ever exist — missing is the correct representation). */
  missingAxisParity: boolean;
  dailyResearchGate: "PASS" | "FAIL" | "UNVERIFIED";
  immutableHistoryVerified: boolean;
}

export function canPromoteModel(evidence: ReleaseEvidence): boolean {
  return evidence.calibratedServingReplay && evidence.missingAxisParity &&
    evidence.dailyResearchGate === "PASS" && evidence.immutableHistoryVerified;
}