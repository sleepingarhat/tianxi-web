// 天喜 · 預測狀態燈：一眼睇得出而家見到嘅四揀係咪最終預測
import { useState } from "react";

import type { DayStatus, LightColor, RaceStatus } from "@/lib/prediction-status";

const DOT: Record<LightColor, string> = {
  green: "bg-win shadow-[0_0_0_3px_rgba(22,120,72,0.14)]",
  amber: "bg-gold shadow-[0_0_0_3px_rgba(160,120,32,0.14)]",
  red: "bg-lose shadow-[0_0_0_3px_rgba(150,40,40,0.14)]",
};

const FRAME: Record<LightColor, string> = {
  green: "border-win/35 bg-win/[0.06]",
  amber: "border-gold-strong/40 bg-gold-bg",
  red: "border-lose/35 bg-lose/[0.06]",
};

const TEXT: Record<LightColor, string> = {
  green: "text-win",
  amber: "text-gold",
  red: "text-lose",
};

export function LightDot({ color, size = 9 }: { color: LightColor; size?: number }) {
  return (
    <span
      aria-hidden
      className={`tx-blink inline-block shrink-0 rounded-full ${DOT[color]}`}
      style={{ width: size, height: size }}
    />
  );
}

/** 三燈圖例（放喺卡片底部解釋燈色） */
export function LightLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] leading-none text-ink-3">
      <span className="inline-flex items-center gap-1">
        <LightDot color="green" size={7} />綠＝最終版，已鎖
      </span>
      <span className="inline-flex items-center gap-1">
        <LightDot color="amber" size={7} />黃＝初版，未鎖
      </span>
      <span className="inline-flex items-center gap-1">
        <LightDot color="red" size={7} />紅＝資料未齊，只作參考、唔入戰績
      </span>
    </div>
  );
}

function SubBar({ s }: { s: RaceStatus }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono-tx text-[9px] leading-none text-ink-3">
      <span className="tabnum">
        天喜LGB 覆蓋 {s.lgbTotal ? `${s.lgbCovered}/${s.lgbTotal}` : "—"}
        {s.lgbTotal && !s.lgbFull ? "（未覆蓋者退回天喜ELO）" : ""}
      </span>
      <span>市場盤口 {s.marketReady ? "已有" : "未有"}（純對照）</span>
      {s.carriedOver ? (
        <span className="rounded-[3px] border border-gold-strong/40 bg-gold-bg px-1 py-[1px] text-gold">
          用{s.modelTrainedOn ?? "上一版"}模型
        </span>
      ) : null}
      {s.scarceStarts > 0 ? (
        <span className="rounded-[3px] border border-gold-strong/40 bg-gold-bg px-1 py-[1px] text-gold">
          少仗 {s.scarceStarts} 匹
        </span>
      ) : null}
      {s.lockAt ? <span className="tabnum">全日鎖定 {s.lockAt}</span> : null}
    </div>
  );
}

/** 單場狀態燈 */
export function PredictionStatusLight({
  status,
  compact = false,
}: {
  status: RaceStatus;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[2px] text-[10px] font-bold leading-none ${FRAME[status.color]} ${TEXT[status.color]}`}
        title={status.reason}
      >
        <LightDot color={status.color} size={7} />
        {status.label}
      </span>
    );
  }
  const shimmer = status.color === "green" ? "tx-beam-card tx-beam-line tx-beam-win" : "";
  return (
    <div className={`rounded-[10px] border px-2.5 py-2 ${FRAME[status.color]} ${shimmer}`}>
      <div className="flex items-center gap-2">
        <LightDot color={status.color} />
        <p className={`font-serif-tc text-[13px] font-bold leading-none ${TEXT[status.color]}`}>
          {status.label}
        </p>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-2">{status.reason}</p>
      <SubBar s={status} />
    </div>
  );
}

/** 賽日總燈（主頁頂部） */
export function DayStatusLight({ status }: { status: DayStatus }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-[10px] border px-2.5 py-2 ${FRAME[status.color]}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <LightDot color={status.color} />
        <span className={`font-serif-tc text-[13px] font-bold leading-none ${TEXT[status.color]}`}>
          {status.label}
        </span>
        <span className="tabnum ml-auto font-mono-tx text-[9px] text-ink-3">
          綠 {status.green} / 黃 {status.amber} / 紅 {status.red}（共 {status.total} 場）
        </span>
        <span className="text-[10px] text-ink-3">{open ? "▲" : "▼"}</span>
      </button>
      <p className="mt-1 text-[10px] leading-relaxed text-ink-2">{status.reason}</p>
      {open ? (
        <div className="mt-2 border-t border-hairline pt-2">
          <LightLegend />
          <p className="mt-1.5 text-[10px] leading-relaxed text-ink-3">
            引擎每日重算：天喜LGB 每日 04:00 重訓、天喜ELO 每日重算，臨場退馬亦會改排位。因此鎖點之前見到嘅四揀屬初版；全日只鎖一次
            —— 第一場開跑前 90 分鐘做最後一次計算後鎖死全日，之後只准補名次，凍結名單就係最終版，用嚟對帳。少仗（第一／二次出賽）只作資料提示，照列正式預測及戰績；不改已鎖分數或四揀。
          </p>
        </div>
      ) : null}
    </div>
  );
}
