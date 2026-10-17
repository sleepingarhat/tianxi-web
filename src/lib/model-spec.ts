// Public model specification, transcribed from tianxi-racing backend source.
// Source of truth: backend/scripts/backtest/{dump-features.ts,predict_upcoming.py},
// backend/scripts/elo/engine.ts, backend/src/routes/analyze.ts.

export type FeatureSpec = { name: string; group: string; derive: string; encode: string };

const RATE = "賽日前全部往績：出賽數及頭三名次數（不平滑）";

export const FEATURES: FeatureSpec[] = [
  { name: "distance", group: "賽事", derive: "今場途程（米）", encode: "數值" },
  { name: "field_size", group: "賽事", derive: "今場出賽匹數", encode: "數值" },
  { name: "draw", group: "賽事", derive: "檔位", encode: "數值" },
  { name: "actual_weight", group: "賽事", derive: "實際負磅（磅）", encode: "數值" },
  { name: "is_sprint", group: "途程組別", derive: "途程 ≤1200m", encode: "0／1" },
  { name: "is_middle", group: "途程組別", derive: "途程 1400–1600m", encode: "0／1" },
  { name: "is_distance", group: "途程組別", derive: "途程 ≥1800m", encode: "0／1" },
  { name: "h_elo", group: "Elo", derive: "馬匹 overall 軸評分，取賽日前最近快照", encode: "數值" },
  { name: "j_elo", group: "Elo", derive: "騎師評分，取賽日前最近快照", encode: "數值" },
  { name: "t_elo", group: "Elo", derive: "練馬師評分，取賽日前最近快照", encode: "數值" },
  { name: "days_since_last", group: "休息", derive: "距上仗日數", encode: "數值；初出為缺失" },
  { name: "dist_starts", group: "途程往績", derive: `同途程 ±200m｜${RATE}`, encode: "計數" },
  { name: "dist_top3", group: "途程往績", derive: "同上，頭三名次數", encode: "計數" },
  { name: "going_starts", group: "場地往績", derive: `同一場地狀況｜${RATE}`, encode: "計數" },
  { name: "going_top3", group: "場地往績", derive: "同上，頭三名次數", encode: "計數" },
  { name: "draw_starts", group: "檔位往績", derive: "同馬場、途程 ±100m、同檔位，全部馬匹歷史", encode: "計數" },
  { name: "draw_top3", group: "檔位往績", derive: "同上，頭三名次數", encode: "計數" },
  { name: "combo_starts", group: "騎練組合", derive: "同一騎師×練馬師組合歷史", encode: "計數" },
  { name: "combo_top3", group: "騎練組合", derive: "同上，頭三名次數", encode: "計數" },
  { name: "weight_avg5", group: "負磅", derive: "近5仗平均實際負磅", encode: "數值" },
  { name: "factor_bonus", group: "加分", derive: "休息＋途程＋場地＋檔位＋負磅＋騎練 六項規則分總和（見下）", encode: "數值" },
  { name: "form_n", group: "近績", derive: "近5仗可用場數", encode: "0–5" },
  { name: "form_avgpos_w", group: "近績", derive: "名次÷出賽匹數，加權 0.40／0.25／0.15／0.10／0.10（最近最重）", encode: "0–1" },
  { name: "form_top3rate_w", group: "近績", derive: "同權重嘅頭三率", encode: "0–1" },
  { name: "form_pos_slope", group: "近績", derive: "近5仗名次線性斜率，正數＝進步", encode: "數值；1仗為0" },
  { name: "tv_starts", group: "交叉往績", derive: "練馬師×馬場出賽數", encode: "計數" },
  { name: "tv_top3", group: "交叉往績", derive: "練馬師×馬場頭三數", encode: "計數" },
  { name: "jv_starts", group: "交叉往績", derive: "騎師×馬場出賽數", encode: "計數" },
  { name: "jv_top3", group: "交叉往績", derive: "騎師×馬場頭三數", encode: "計數" },
  { name: "jdb_starts", group: "交叉往績", derive: "騎師×途程 ±200m 出賽數", encode: "計數" },
  { name: "jdb_top3", group: "交叉往績", derive: "騎師×途程 ±200m 頭三數", encode: "計數" },
  { name: "jg_starts", group: "交叉往績", derive: "騎師×場地狀況出賽數", encode: "計數" },
  { name: "jg_top3", group: "交叉往績", derive: "騎師×場地狀況頭三數", encode: "計數" },
  { name: "tg_starts", group: "交叉往績", derive: "練馬師×場地狀況出賽數", encode: "計數" },
  { name: "tg_top3", group: "交叉往績", derive: "練馬師×場地狀況頭三數", encode: "計數" },
  { name: "horse_pace_n", group: "跑法", derive: "近8仗有沿途走位紀錄嘅場數", encode: "計數" },
  { name: "horse_pace_early", group: "跑法", derive: "近8仗第一個走位點平均位置", encode: "數值" },
  { name: "horse_pace_style", group: "跑法", derive: "早段平均 ≤2.5 領放、≤4 跟前、其餘後追", encode: "1／2／3；無資料0" },
  { name: "race_n_leaders", group: "步速", derive: "今場領放型馬匹數", encode: "計數" },
  { name: "race_n_closers", group: "步速", derive: "今場後追型馬匹數", encode: "計數" },
  { name: "horse_pace_clash", group: "步速", derive: "領放：−(領放數−1)；後追：max(0, 2−後追數)；跟前：0", encode: "數值" },
  { name: "class_now_num", group: "班次", derive: "今場班次；一級賽−1…三級賽−3，第一至五班1–5，新馬6", encode: "數值（細＝高班）" },
  { name: "last_class_num", group: "班次", derive: "上仗班次，同一轉換", encode: "數值" },
  { name: "class_delta", group: "班次", derive: "上仗班次 − 今場班次（正數＝升班）", encode: "數值" },
  { name: "sect_n", group: "分段", derive: "近6仗有分段紀錄場數", encode: "0–6" },
  { name: "sect_early_avg", group: "分段", derive: "首段位置平均", encode: "數值" },
  { name: "sect_late_kick", group: "分段", derive: "首段位置 − 末段位置平均，正數＝後上", encode: "數值" },
  { name: "draw_x_sprint", group: "交互", derive: "短途時取檔位，否則0", encode: "數值" },
  { name: "paceclash_x_distance", group: "交互", derive: "長途時取步速衝突值，否則0", encode: "數值" },
  { name: "sire_top3_sm", group: "血統", derive: "父系子女頭三率，(頭三＋40×全體率)÷(出賽＋40)", encode: "0–1；無血統−1" },
  { name: "sire_dist_top3_sm", group: "血統", derive: "父系子女於同途程 ±200m 頭三率，同一平滑", encode: "0–1；無血統−1" },
  { name: "damsire_top3_sm", group: "血統", derive: "外祖父子女頭三率，同一平滑", encode: "0–1；無血統−1" },
];

export const FACTOR_RULES = [
  { name: "休息", rule: "<7日 −10；7–28日 +10；29–60日 0；61–120日 −5；>120日 −15；初出 0" },
  { name: "途程", rule: "rate(途程往績, 15)" },
  { name: "場地", rule: "rate(場地往績, 12)" },
  { name: "檔位", rule: "rate(檔位往績, 10)" },
  { name: "負磅", rule: "−(今場負磅 − 近5仗平均) × 0.5" },
  { name: "騎練", rule: "rate(騎練組合往績, 8)" },
];

export const ELO = {
  k: { horse: 28, jockey: 18, trainer: 11 },
  tau: { horse: 548, jockey: 730, trainer: 1095 },
  provisionalGames: 6,
  provisionalMultiplier: 1.5,
  initial: 1500,
  weights: { horse: 0.7, jockey: 0.2, trainer: 0.1 },
  axes: ["overall", "turf_sprint", "turf_mile", "turf_middle", "turf_staying"],
};

export const LGB = {
  objective: "lambdarank",
  metric: "生產早停：逐場race_logloss；回測另計NDCG",
  truncation: 4,
  labelGain: "[0, 1, 7, 31, 127, …]",
  labels: "第1名→4、第2名→3、第3名→2、第4名→1、第5名或之後→0",
  missing: "全部特徵缺失值填 −1",
  categorical: "生產52項全部為數值；going_code只見於另一路回測",
  alpha: 0.88,
};
