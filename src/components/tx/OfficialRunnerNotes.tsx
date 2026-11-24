import { asVenue, officialBoardPath, readConghuaRows, readFwbRows, readJtRows, readOveRows } from "@/lib/official-boards";
import { runnerMeetingFacts, type RunnerFact, type RunnerSlot } from "@/lib/official-library";

import { useBoard } from "./OfficialBoardParts";

export function OfficialRunnerNotes({ facts }: { facts: RunnerFact[] }) {
  if (!facts.length) return null;
  return (
    <ul className="mt-1.5 space-y-1 rounded-[6px] border border-hairline bg-paper px-2 py-1.5">
      {facts.map((fact) => (
        <li key={fact.key} className="text-[11px] leading-relaxed text-ink-2">
          <span className="font-bold text-ink-3">{fact.label}</span>
          {" "}
          {fact.text}
        </li>
      ))}
    </ul>
  );
}

/** 賽日獸醫、從化、騎練、特別獎金。只喺正式排位或完場先讀。 */
export function useMeetingOfficialNotes(date: string | null | undefined, venue: string | null | undefined, enabled: boolean) {
  const place = asVenue(venue);
  const meeting = enabled && date && place ? { date, venue: place } : null;
  const ove = useBoard(meeting ? officialBoardPath("ove-record", meeting) : null);
  const conghua = useBoard(meeting ? officialBoardPath("conghua-movement", meeting) : null);
  const jt = useBoard(meeting ? officialBoardPath("jt-combo", meeting) : null);
  const fwb = useBoard(meeting ? officialBoardPath("fwb-declared", meeting) : null);
  const rows = {
    ove: ove.data ? readOveRows(ove.data) : [],
    conghua: conghua.data ? readConghuaRows(conghua.data) : [],
    jt: jt.data ? readJtRows(jt.data) : [],
    fwb: fwb.data ? readFwbRows(fwb.data) : [],
  };
  return {
    enabled: meeting != null,
    loading: meeting != null && (ove.isPending || conghua.isPending || jt.isPending || fwb.isPending),
    error: ove.isError || conghua.isError || jt.isError || fwb.isError,
    factsFor(slot: RunnerSlot): RunnerFact[] {
      return meeting ? runnerMeetingFacts(rows, slot) : [];
    },
  };
}
