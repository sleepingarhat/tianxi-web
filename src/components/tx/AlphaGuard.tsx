/**
 * 集成比重（α）健康警示
 *
 * 用途：α 係「天喜LGB」對最終排序嘅影響力。歷史上曾經因為緊急覆寫（/api/set-alpha）
 * 令 α 長期停留在 0，即係最終排序其實完全等於天喜ELO 基準，但前端一直冇提示。
 * 呢個組件就係把 α 狀態明明白白顯示出嚟：
 *   綠 = α 正常（天喜LGB 真正影響排名）
 *   黃 = α 偏離現行設定（多數係賽前鎖定存檔版本，屬正常）
 *   紅 = α 過低／歸零（天喜LGB 幾乎唔影響排名，要查健康閘同覆寫紀錄）
 */

/** 生產現行設定值（回測後於 2026-09-08 定為 0.85） */
export const ALPHA_EXPECTED = 0.85;
/** 低於此值視為天喜LGB 幾乎失效 */
export const ALPHA_FLOOR = 0.5;

export type AlphaLevel = "ok" | "watch" | "alert" | "unknown";

export function alphaLevel(alpha: number | null | undefined, expected = ALPHA_EXPECTED): AlphaLevel {
  if (alpha == null || !Number.isFinite(alpha)) return "unknown";
  if (alpha < ALPHA_FLOOR) return "alert";
  if (Math.abs(alpha - expected) > 0.05) return "watch";
  return "ok";
}

const TONE: Record<AlphaLevel, { box: string; dot: string; text: string; label: string }> = {
  ok: {
    box: "border-win/35 bg-win/[0.07]",
    dot: "bg-win",
    text: "text-win",
    label: "正常",
  },
  watch: {
    box: "border-gold-strong/45 bg-gold-bg",
    dot: "bg-gold",
    text: "text-gold",
    label: "留意",
  },
  alert: {
    box: "border-lose/40 bg-lose/[0.07]",
    dot: "bg-lose",
    text: "text-lose",
    label: "警示",
  },
  unknown: {
    box: "border-hairline bg-paper",
    dot: "bg-ink-3",
    text: "text-ink-3",
    label: "未取得",
  },
};

export function AlphaGuard({
  alpha,
  expected = ALPHA_EXPECTED,
  frozen = false,
  className = "",
}: {
  alpha: number | null | undefined;
  expected?: number;
  /** 賽前鎖定存檔版：α 與現行設定不同屬正常，只提示、唔當異常 */
  frozen?: boolean;
  className?: string;
}) {
  const level = alphaLevel(alpha, expected);
  const t = TONE[level];
  const value = alpha != null && Number.isFinite(alpha) ? alpha.toFixed(2) : "—";

  const msg =
    level === "alert"
      ? `天喜LGB 幾乎唔影響排名（α=${value}，正常應為 ${expected.toFixed(2)}）。最終排序基本上等同天喜ELO 基準，請檢查健康閘同緊急覆寫紀錄。`
      : level === "watch"
        ? frozen
          ? `此賽日以當時鎖定嘅 α=${value} 出預測，與現行設定 ${expected.toFixed(2)} 不同（存檔版本，屬正常）。`
          : `α=${value} 偏離現行設定 ${expected.toFixed(2)}，請確認係有意調整抑或閘門降權。`
        : level === "ok"
          ? `α=${value}：天喜LGB 主導最終排序，天喜ELO 作基準支撐。`
          : "未取得 α 數值（預測未生成或後端未回傳）。";

  return (
    <div className={`rounded-[10px] border px-2.5 py-2 ${t.box} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-bold leading-none text-ink-2">
          <span className={`tx-blink inline-block h-[7px] w-[7px] rounded-full ${t.dot}`} />
          集成比重 α 健康
          <span className="font-mono-tx text-[8px] uppercase tracking-[0.18em] text-ink-3">Alpha Guard</span>
        </p>
        <p className={`tabnum shrink-0 font-mono-tx text-[12px] font-bold leading-none ${t.text}`}>
          {t.label} · α={value}
        </p>
      </div>
      <p className="mt-1.5 text-[9.5px] leading-[1.5] text-ink-3">{msg}</p>
    </div>
  );
}
