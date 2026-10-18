/** Release evidence must describe the calibrated serving replay, not raw-margin sensitivity. */
export interface ReleaseEvidence {
  calibratedServingReplay: boolean;
  missingAxisParity: boolean;
  dailyResearchGate: "PASS" | "FAIL" | "UNVERIFIED";
  immutableHistoryVerified: boolean;
}

export function canPromoteModel(evidence: ReleaseEvidence): boolean {
  return evidence.calibratedServingReplay && evidence.missingAxisParity &&
    evidence.dailyResearchGate === "PASS" && evidence.immutableHistoryVerified;
}