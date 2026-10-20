/** 由呢日起，所有頁面只展示已核實原始凍結副本；之前嘅賽日照列舊紀錄，但標明未經副本核實。 */
export const STRICT_EVIDENCE_FROM = "2026-10-21";
export const isLegacyEvidenceDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && date < STRICT_EVIDENCE_FROM;
