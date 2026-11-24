import type { RaceVoid } from "@/lib/race-settlement-display";

/** 單場取消。全日停賽仍然用 MeetingCancellationNotice。 */
export function RaceVoidNotice({
  race,
  compact = false,
  hideLabel = false,
}: {
  race: RaceVoid;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <div
      role="status"
      className={
        compact ? "mt-1.5" : "my-2 rounded-[8px] border border-lose/40 bg-lose/[0.06] px-3 py-2.5"
      }
    >
      {hideLabel ? null : (
        <p
          className={`font-serif-tc font-bold text-lose ${compact ? "text-[13px]" : "text-[15px]"}`}
        >
          {race.label}
        </p>
      )}
      {race.reason ? (
        <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{race.reason}</p>
      ) : null}
      <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
        凍結四揀保留。呢場作廢，唔計入戰績。
      </p>
    </div>
  );
}
