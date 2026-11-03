import { Pill } from "./ui";

import type { MeetingCancellation } from "@/lib/meeting-status";
import { fmtMeetingDate } from "@/lib/tx-api";

const SOURCE_LABEL: Record<string, string> = {
  override: "人手覆核",
  official: "馬會公告",
  structure: "賽日結構偵測",
  fallback: "離線備份名單",
};

export function MeetingCancellationNotice({ cancellation }: { cancellation: MeetingCancellation }) {
  const suspected = cancellation.status === "suspected";
  const source = cancellation.source ? SOURCE_LABEL[cancellation.source] ?? cancellation.source : "";

  return (
    <section
      className={
        suspected
          ? "mx-4 my-3 border-y-2 border-gold bg-gold/[0.08] px-3 py-3"
          : "mx-4 my-3 border-y-2 border-lose bg-lose/[0.06] px-3 py-3"
      }
      role="status"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className={`font-serif-tc text-[17px] font-bold ${suspected ? "text-gold-strong" : "text-lose"}`}
          >
            {cancellation.label}
          </p>
          <p className="tabnum mt-0.5 font-mono-tx text-[11px] text-ink-3">
            {fmtMeetingDate(cancellation.date)}
            {source ? ` · 來源：${source}` : ""}
          </p>
        </div>
        <Pill tone={suspected ? "gold" : "lose"}>{suspected ? "疑似停賽" : "停賽"}</Pill>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-2">{cancellation.reason}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
        引擎自動偵測：先讀人手覆核檔，再比對馬會公告，最後檢查排位表是否無場次。停賽或疑似停賽一律不生成、不鎖定預測，亦不計入戰績。
      </p>
    </section>
  );
}
