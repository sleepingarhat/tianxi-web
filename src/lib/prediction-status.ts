// 天喜 · 預測狀態燈邏輯（單一真相，前端共用）
// 綠燈＝已鎖定最終預測；黃燈＝仍會更新；紅燈＝資料未齊，只作參考。

export type LightColor = "green" | "amber" | "red";

export type RaceStatus = {
  raceNumber: number;
  color: LightColor;
  label: string;
  reason: string;
  /** 距離開跑鎖定的預計時間（HH:MM），已鎖定則為 null */
  lockAt: string | null;
  lgbCovered: number;
  lgbTotal: number;
  lgbFull: boolean;
  marketReady: boolean;
  settled: boolean;
  /** 分數係用上一版（非當日）模型頂住 */
  carriedOver: boolean;
  /** 該模型嘅訓練日期（YYYY-MM-DD），未知為 null */
  modelTrainedOn: string | null;
  /** 四揀之中出賽 ≤2 次嘅馬匹數（少仗提示，不影響正式資格） */
  scarceStarts: number;
};

/** 全日只鎖一次：第一場開跑前 90 分鐘鎖死全日四揀（同後端 lock-window 一致） */
export const DAY_LOCK_MINUTES_BEFORE_FIRST_POST = 90;

/** 少仗提示門檻：出賽次數 ≤ 2（第一、二次出賽），不改分數或正式資格 */
export const SCARCE_START_THRESHOLD = 2;

const pad = (n: number) => String(n).padStart(2, "0");

/** 把 "14:00"／"2026-09-06T14:00" 之類轉成當日分鐘數（香港時間） */
function toMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = /(\d{1,2}):(\d{2})/.exec(String(t));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function fmtMinutes(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

/**
 * 模型版本字串形如 `lgb-ensemble-20260913`，重訓失敗時由後備流程上傳
 * `lgb-ensemble-20260912+carry` —— 保留原訓練日期並標明係頂住用。
 * 取出訓練日期，並判斷是否非當日模型。
 */
export function modelProvenance(
  version: unknown,
  today: string,
): { carriedOver: boolean; trainedOn: string | null } {
  const raw = version == null ? "" : String(version);
  const m = /(\d{4})(\d{2})(\d{2})/.exec(raw);
  const trainedOn = m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  const carriedOver = /\+carry/i.test(raw) || (!!trainedOn && trainedOn < today);
  return { carriedOver, trainedOn };
}

/** 香港時間「今日日期」與「現在分鐘數」 */
export function hkNow(now = new Date()): { date: string; minutes: number } {
  const hk = new Date(now.getTime() + 8 * 3600_000);
  return {
    date: `${hk.getUTCFullYear()}-${pad(hk.getUTCMonth() + 1)}-${pad(hk.getUTCDate())}`,
    minutes: hk.getUTCHours() * 60 + hk.getUTCMinutes(),
  };
}

/** 全日鎖點（香港時間分鐘數）＝第一場開跑 − 90 分鐘；無賽程時間回傳 null */
export function meetingLockMinutes(races: any[]): number | null {
  const posts = (races || [])
    .map((r) => toMinutes(r?.startTime))
    .filter((v): v is number => v != null);
  if (!posts.length) return null;
  return Math.min(...posts) - DAY_LOCK_MINUTES_BEFORE_FIRST_POST;
}

export function raceStatus(
  race: any,
  opts: {
    date?: string;
    now?: Date;
    /** 全日鎖點分鐘數（由 meetingLockMinutes 計出），唔傳就以本場開跑推算 */
    lockMinutes?: number | null;
    /** 本場四揀之中出賽 ≤2 次嘅馬匹數（少仗提示，不影響正式資格） */
    scarceStarts?: number;
    /** 提供時只承認這份預測狀態，不用時間代證。 */
    frozen?: boolean;
  } = {},
): RaceStatus {
  const picks: any[] = race?.picks || [];
  const lgbTotal = picks.length;
  const lgbCovered = picks.filter(
    (p) => p?.scoreSource === "lgb" || p?.lgbScore != null || p?.pLgb != null,
  ).length;
  const raceIsLgb = race?.scoreSource === "lgb";
  // 場次層級為 LGB 時，視同全場覆蓋（後端以整場判定）
  const covered = raceIsLgb ? (lgbCovered || lgbTotal) : lgbCovered;
  const lgbFull = lgbTotal > 0 && covered >= lgbTotal;

  const marketReady = picks.some((p) => Number(p?.winOdds) > 0);
  const settled =
    picks.some((p) => p?.finishingPosition != null) ||
    race?.settled === true ||
    race?.hasResult === true;

  const { date: today, minutes: nowMin } = hkNow(opts.now);
  const meetingDate = opts.date;
  const postMin = toMinutes(race?.startTime);
  const lockMin =
    opts.lockMinutes != null
      ? opts.lockMinutes
      : postMin == null
        ? null
        : postMin - DAY_LOCK_MINUTES_BEFORE_FIRST_POST;

  const dayIsPast = !!meetingDate && meetingDate < today;
  const dayIsFuture = !!meetingDate && meetingDate > today;
  const lockedByTime =
    opts.frozen ?? (settled || dayIsPast || (!dayIsFuture && lockMin != null && nowMin >= lockMin));

  // 上一版模型後備：夜間重訓失敗時，後備流程用最近一次成功嘅模型評分頂住，
  // 唔會退回純 ELO 基準；但要如實標明「用昨日模型」。已封存嘅舊賽日不標。
  const prov = modelProvenance(race?.lgbModelVersion, meetingDate || today);
  const carriedOver = prov.carriedOver && !settled && !dayIsPast;
  const modelTrainedOn = prov.trainedOn;
  const carryNote = carriedOver
    ? `（用${prov.trainedOn ?? "上一版"}模型頂住，夜間重訓未完成）`
    : "";

  const scarce = Math.max(0, Number(opts.scarceStarts ?? 0) || 0);
  const scarceNote = scarce > 0
    ? `；四揀有 ${scarce} 匹第一／二次出賽少仗馬，照列正式預測，賽後按凍結四揀計戰績`
    : "";
  const base = {
    raceNumber: race?.raceNumber,
    lgbTotal,
    marketReady,
    settled,
    modelTrainedOn,
    scarceStarts: scarce,
  };

  // 紅燈：資料未齊 —— 全場退回天喜ELO 基準，或未有排位／預測資料
  if (lgbTotal === 0) {
    return {
      ...base,
      color: "red",
      label: "初版 · 資料未齊",
      reason: "尚未取得排位或預測資料",
      lockAt: lockMin == null ? null : fmtMinutes(lockMin),
      lgbCovered: 0,
      lgbTotal: 0,
      lgbFull: false,
      marketReady: false,
      carriedOver: false,
    };
  }
  if (!raceIsLgb && covered === 0) {
    return {
      ...base,
      color: "red",
      label: "初版 · 資料未齊",
      reason: "本場退回天喜ELO 基準（天喜LGB 未覆蓋），只作參考",
      lockAt: lockMin == null ? null : fmtMinutes(lockMin),
      lgbCovered: 0,
      lgbFull: false,
      carriedOver: false,
    };
  }

  if (lockedByTime) {
    return {
      ...base,
      color: "green",
      label: carriedOver ? "最終版 · 已鎖（昨日模型）" : "最終版 · 已鎖",
      reason:
        (settled || dayIsPast
          ? "賽果已出，凍結四揀已封存"
          : `已過全日鎖點，四揀不再變動，只准補名次${carryNote}`) + scarceNote,
      lockAt: null,
      lgbCovered: covered,
      lgbFull,
      carriedOver,
    };
  }

  return {
    ...base,
    color: "amber",
    label: carriedOver ? "初版 · 未鎖（昨日模型）" : "初版 · 未鎖",
    reason:
      (lockMin == null
        ? "仍會更新（天喜LGB 每日 04:00 重訓、天喜ELO 每日重算、退馬會改排位）"
        : `仍會更新，${fmtMinutes(lockMin)} 鎖全日（首場開跑前 ${DAY_LOCK_MINUTES_BEFORE_FIRST_POST} 分鐘）`) +
      carryNote + scarceNote,
    lockAt: lockMin == null ? null : fmtMinutes(lockMin),
    lgbCovered: covered,
    lgbFull,
    carriedOver,
  };
}

export type DayStatus = {
  color: LightColor;
  label: string;

  reason: string;
  green: number;
  amber: number;
  red: number;
  total: number;
};

export function dayStatus(
  races: any[],
  date?: string,
  now?: Date,
  scarceByRace?: Record<number, number>,
): DayStatus {
  const lockMinutes = meetingLockMinutes(races);
  const list = (races || []).map((r) =>
    raceStatus(r, {
      ...(date ? { date } : {}),
      ...(now ? { now } : {}),
      lockMinutes,
      scarceStarts: scarceByRace?.[Number(r?.raceNumber)] ?? 0,
    }),
  );
  const lockClock = lockMinutes == null ? null : fmtMinutes(lockMinutes);
  const green = list.filter((s) => s.color === "green").length;
  const amber = list.filter((s) => s.color === "amber").length;
  const red = list.filter((s) => s.color === "red").length;
  const total = list.length;
  const carried = list.filter((s) => s.carriedOver).length;
  const carryNote = carried
    ? `；其中 ${carried} 場用上一版模型頂住（夜間重訓未完成，未退回 ELO 基準）`
    : "";
  if (!total)
    return { color: "red", label: "未有預測", reason: "尚未取得賽日資料", green, amber, red, total };
  if (red > 0) {
    return {
      color: "red",
      label: `${red} 場資料未齊`,
      reason: `未齊場次退回天喜ELO 基準或排位未齊；少仗本身不影響正式預測及戰績資格${carryNote}`,
      green,
      amber,
      red,
      total,
    };
  }
  if (amber > 0)
    return {
      color: "amber",
      label: `初版 · 未鎖（${amber} 場會更新）`,
      reason: `全日${lockClock ? ` ${lockClock}` : ""}一次鎖定（首場開跑前 ${DAY_LOCK_MINUTES_BEFORE_FIRST_POST} 分鐘），鎖後只准補名次${carryNote}`,
      green,
      amber,
      red,
      total,
    };
  return {
    color: "green",
    label: carried ? "最終版 · 已鎖（昨日模型）" : "最終版 · 已鎖",
    reason: `全日四揀已凍結，可對帳${carryNote}`,
    green,
    amber,
    red,
    total,
  };
}
