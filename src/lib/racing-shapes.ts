// 天喜 · 後端 JSON 回應形狀（共用類型）
// 只描述實際使用嘅欄位；所有欄位可缺（optional），唔會假設後端一定回傳。
import type { RaceHorse } from "./tx-api";

/** 馬會更改（退出／換騎）公告附在揀馬上 */
export type OfficialChange = {
  raceNumber?: number | string | null;
  horseNumber?: number | string | null;
  announcedAt?: string | null;
  announcedAtIso?: string | null;
  text?: string | null;
};

/** 全日／凍結預測入面嘅單匹揀馬列 */
export type PickRow = {
  horseNumber?: number | string | null;
  horseId?: string | null;
  nameCh?: string | null;
  nameEn?: string | null;
  jockeyCh?: string | null;
  trainerCh?: string | null;
  draw?: number | string | null;
  pWin?: number | null;
  pTop3?: number | null;
  pTop4?: number | null;
  pLgb?: number | null;
  lgbScore?: number | null;
  rank?: number | null;
  winOdds?: number | null;
  liveWinOdds?: number | null;
  weight?: number | null;
  declaredWeight?: number | null;
  rating?: number | null;
  code?: string | null;
  gear?: string | null;
  scoreSource?: string | null;
  frozen?: boolean;
  finishingPosition?: number | null;
  factorBonus?: number | null;
  factorBreakdown?: Record<string, { bonus?: number | null; note?: string | null }> | null;
  officialChange?: OfficialChange | null;
};

/** 全日／凍結預測入面嘅單場列 */
export type RaceRow = {
  raceNumber?: number | string | null;
  raceId?: string | null;
  id?: string | null;
  title?: string | null;
  startTime?: string | null;
  distance?: number | null;
  distanceM?: number | null;
  className?: string | null;
  class?: string | null;
  going?: string | null;
  course?: string | null;
  scoreSource?: string | null;
  lgbModelVersion?: string | null;
  lgbCoverage?: { applied?: boolean | null; rows?: number | null } | null;
  ensembleAlpha?: number | null;
  settled?: boolean;
  hasResult?: boolean;
  /** 該場已核實原四揀命中數（0–4）。只喺會籍可見完整場次先附上，唔包含賽果馬號。 */
  verifiedHitCount?: number | null;
  officialChange?: OfficialChange | null;
  picks?: PickRow[];
};

/** 引擎中介資料（alpha、模型版本、鎖點等） */
export type EngineMeta = {
  lockAt?: string | null;
  eloEngine?: string | null;
  eloReady?: boolean;
  eloWeights?: { horse?: number | null; jockey?: number | null; trainer?: number | null } | null;
  lgbModelVersion?: string | null;
  lgbCoverage?: { rows?: number | null } | null;
  computeMs?: number | null;
  probabilityEvidence?: { pTop4?: string | null } | null;
};

/** /api/analyze/today-picks 及凍結讀回嘅全日預測回應 */
export type DayPicks = {
  date?: string;
  venue?: string;
  trackCondition?: string | null;
  generatedAt?: string | null;
  lockAt?: string | null;
  frozen?: boolean;
  edition?: string;
  publicationDeadline?: string;
  noMeeting?: boolean;
  message?: string;
  scoreSource?: string | null;
  engine?: EngineMeta | null;
  meta?: EngineMeta | null;
  races?: RaceRow[];
};

/* ---------- 對帳／解釋（hit-rate） ---------- */

export type HitRateHorse = {
  horseId?: string | null;
  horseNumber?: number | string | null;
  nameCh?: string | null;
  nameEn?: string | null;
  winOdds?: number | null;
  position?: number | null;
  rank?: number | null;
  scoreSource?: string | null;
  hit?: boolean | number | null;
  pTop4?: number | null;
  pWin?: number | null;
};

export type HitRateRace = {
  raceNumber?: number | string | null;
  raceId?: string | null;
  distance?: number | null;
  going?: string | null;
  scoreSource?: string | null;
  top4IntersectCount?: number | null;
  top3IntersectCount?: number | null;
  quinellaHit?: boolean | number | null;
  qpHit?: boolean | number | null;
  predictedTop4?: HitRateHorse[];
  actualTop4?: HitRateHorse[];
};

export type HitRateSummary = {
  racesEvaluated?: number | null;
  top4AvgIntersect?: number | null;
  top3AvgIntersect?: number | null;
};

export type HitRateMeetingResponse = {
  date?: string;
  venue?: string;
  trackCondition?: string | null;
  summary?: HitRateSummary | null;
  races?: HitRateRace[];
};

/* ---------- 策略盈虧 ---------- */

export type StrategyPoint = {
  date?: string | null;
  cost?: number | null;
  payout?: number | null;
  net?: number | null;
  cum?: number | null;
  wins?: number | null;
  racesBet?: number | null;
  pools?:
    | { pool?: string | null; cost?: number | null; payout?: number | null; consPayout?: number | null; mainHit?: boolean | null }[]
    | null;
};

export type StrategyPnlResponse = {
  from?: string | null;
  to?: string | null;
  daysEvaluated?: number | null;
  racesBet?: number | null;
  points?: StrategyPoint[] | null;
  poolBreakdown?:
    | Record<string, { wins?: number | null; bets?: number | null; cons?: number | null; cost?: number | null; payout?: number | null; net?: number | null }>
    | null;
};

/* ---------- 賠率與賽事詳情 ---------- */

export type OddsSnapshot = {
  winOdds?: Record<string, number> | null;
  plaOdds?: Record<string, number> | null;
  snapshotAt?: string | null;
  live?: boolean | null;
};

export type RaceDetail = {
  id?: string | null;
  date?: string | null;
  raceNumber?: number | string | null;
  title?: string | null;
  class?: string | null;
  className?: string | null;
  distance?: number | null;
  distanceM?: number | null;
  going?: string | null;
  course?: string | null;
  horses?: RaceHorse[] | null;
  entries?: RaceHorse[] | null;
};

export type TopPicksResponse = {
  frozen?: boolean;
  picks?: PickRow[];
  scoreSource?: string | null;
};

export type RunningStylesResponse = {
  cutoffDate?: string | null;
  styles?: { code?: string; label?: string; sampleCount?: number }[];
};

/* ---------- 馬匹研究（research-v2） ---------- */

export type ResearchValue = string | number | null;
export type HorseResearchRow = {
  [key: string]: ResearchValue | undefined;
};
export type HorseFormRow = Omit<HorseResearchRow, 'gear' | 'sectionals'> & {
  gear?: string | string[] | null;
  sectionals?: HorseResearchRow[] | null;
};
export type HorseResearchPayload = {
  horse?: {
    id?: string;
    name?: string | null;
    nameCh?: string | null;
    code?: string | null;
    nameEn?: string | null;
    status?: string | null;
    currentRating?: number | null;
    record?: { totalStarts?: ResearchValue; wins?: ResearchValue; seconds?: ResearchValue; thirds?: ResearchValue };
    lastRaceDate?: string | null;
    countryOfOrigin?: string | null;
    colour?: string | null;
    sex?: string | null;
    importType?: string | null;
    currentTrainer?: string | null;
    owner?: string | null;
    sire?: string | null;
    dam?: string | null;
    damSire?: string | null;
    pedigree?: { sire?: string | null; dam?: string | null; damSire?: string | null } | null;
    halfSiblings?: string[] | string | null;
    seasonStakes?: ResearchValue;
    totalStakes?: ResearchValue;
  } | null;
  elo?: {
    latest?: { rating?: number | null; gamesPlayed?: number | null; asOfDate?: string | null } | null;
    history?: { rating?: number | null; asOfDate?: string | null }[];
  } | null;
  recentForm?: HorseFormRow[];
  performance?: { note?: string; [key: string]: HorseResearchRow[] | string | undefined };
  researchSignals?: HorseResearchRow[];
  training?: { trackwork?: HorseResearchRow[]; barrierTrials?: HorseResearchRow[]; [key: string]: HorseResearchRow[] | undefined };
  health?: { injuries?: HorseResearchRow[] } | null;
  meta?: {
    counts?: Record<string, number | string>;
    sources?: string[];
    dataAsOf?: string | null;
    profile?: { sourceUrl?: string | null } | null;
    coverageNotes?: string[];
  } | null;
};

/* ---------- 引擎健康（/api/public/engine-health） ---------- */

export type EngineCheck = {
  key?: string;
  label?: string;
  status?: string;
  note?: string;
  detail?: string;
  message?: string;
  [key: string]: unknown;
};

export type EngineHealthPayload = {
  summary?: Record<string, unknown> | unknown[] | null;
  season?: { label?: string | null; [key: string]: unknown } | null;
  checks?: EngineCheck[];
  gates?: EngineCheck[];
  [key: string]: unknown;
};
