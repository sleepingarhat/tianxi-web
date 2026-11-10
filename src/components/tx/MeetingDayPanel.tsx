import { Link } from "@tanstack/react-router";

import {
  cardStatusLabel,
  cardStatusOf,
  drawStatusLabel,
  drawStatusOf,
  effectiveCardStatus,
  effectiveDrawStatus,
  imposedWeightLabel,
  meetingRacesEmptyLabel,
  runnerMeasures,
  showsDeclaredCard,
  type CardStatus,
} from "@/lib/meeting-card";
import { canonicalHorseId, canonicalRaceId, type Meeting, type RaceHorse, type RaceSummary } from "@/lib/tx-api";

import { Pill, Scroller, Silks, Table, Td } from "./ui";

export function MeetingStatusPills({
  meeting,
}: {
  meeting: {
    cardStatus?: string | null | undefined;
    isDeclaredCard?: boolean | null | undefined;
    drawStatus?: string | null | undefined;
    drawNote?: string | null | undefined;
  };
}) {
  const status = cardStatusOf(meeting);
  const label = cardStatusLabel(status);
  const draw = meeting.drawNote ? null : drawStatusLabel(drawStatusOf(meeting.drawStatus));
  if (!label && !draw) return null;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {label ? <Pill tone={status === "declared" || status === "resulted" ? "gold" : "ink"}>{label}</Pill> : null}
      {draw ? <Pill>{draw}</Pill> : null}
    </span>
  );
}

function raceDistance(race: RaceSummary): string {
  const metres = race.distance || race.distanceM;
  return metres ? `${metres}m` : "";
}

function RunnerRoster({
  race,
  meeting,
}: {
  race: RaceSummary;
  meeting: Meeting;
}) {
  const horses = race.horses || [];
  const status = effectiveCardStatus(race, meeting);
  const drawStatus = effectiveDrawStatus(race, meeting);
  const declared = showsDeclaredCard(status);
  if (!horses.length) return <p className="py-2 text-[12px] text-ink-3">此場未有馬匹</p>;
  if (!declared) {
    return (
      <ul className="divide-y divide-hairline">
        {horses.map((horse) => (
          <EntryRow key={horse.id || horse.code || horse.nameCh} horse={horse} />
        ))}
      </ul>
    );
  }
  const labels = ["檔位", imposedWeightLabel(race.title), "排位體重"];
  return (
    <Scroller>
      <Table head={["馬匹", ...labels]}>
        {horses.map((horse) => {
          const row = runnerMeasures({ horse, title: race.title, cardStatus: status, drawStatus });
          const name = horse.nameCh || horse.name || "未命名";
          const id = canonicalHorseId(horse.id);
          return (
            <tr key={horse.id || `${horse.horseNumber}-${name}`} className="border-b border-hairline">
              <Td first>
                <span className="flex min-w-0 items-center gap-1.5">
                  {horse.horseNumber != null ? (
                    <span className="tabnum grid h-6 w-6 shrink-0 place-items-center rounded-[4px] border border-hairline font-mono-tx text-[11px] font-bold">
                      {horse.horseNumber}
                    </span>
                  ) : null}
                  <Silks source={horse} size={28} />
                  {id ? (
                    <Link to="/horse" search={{ id }} className="truncate font-serif-tc text-[13px] font-bold">
                      {name}
                    </Link>
                  ) : (
                    <span className="truncate font-serif-tc text-[13px] font-bold">{name}</span>
                  )}
                </span>
              </Td>
              {labels.map((label) => (
                <Td key={label}>{row.find((item) => item.label === label)?.value ?? "—"}</Td>
              ))}
            </tr>
          );
        })}
      </Table>
    </Scroller>
  );
}

function EntryRow({ horse }: { horse: RaceHorse }) {
  const name = horse.nameCh || horse.name || "未命名";
  const id = canonicalHorseId(horse.id);
  const trainer = horse.trainerCh || horse.trainer || "";
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Silks source={horse} size={28} />
      {id ? (
        <Link to="/horse" search={{ id }} className="min-w-0 flex-1 truncate font-serif-tc text-[13px] font-bold">
          {name}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate font-serif-tc text-[13px] font-bold">{name}</span>
      )}
      {trainer ? <span className="max-w-[40%] truncate text-[11px] text-ink-3">{trainer}</span> : null}
    </li>
  );
}

export function MeetingDayPanel({
  meeting,
  activeRaceId,
  onRace,
}: {
  meeting: Meeting;
  activeRaceId: string | null;
  onRace: (id: string) => void;
}) {
  const status: CardStatus | null = cardStatusOf(meeting);
  const races = meeting.races || [];
  const declared = showsDeclaredCard(status);
  return (
    <div className="pb-3 pl-1">
      {!races.length ? (
        <p className="py-2 text-[12px] text-ink-3">{meetingRacesEmptyLabel(status)}</p>
      ) : (
        <div className="divide-y divide-hairline border-l border-hairline pl-3">
          {races.map((race) => {
            const open = race.id === activeRaceId;
            const raceId = canonicalRaceId(race.id);
            const horses = race.horses || [];
            return (
              <div key={race.id}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onRace(race.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
                    <span className="tabnum w-7 shrink-0 font-mono-tx text-[11px] font-bold text-gold">R{race.raceNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{race.title || `第 ${race.raceNumber} 場`}</span>
                    <span className="tabnum shrink-0 font-mono-tx text-[11px] text-ink-3">
                      {[raceDistance(race), horses.length ? `${horses.length} 匹` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                  {declared && raceId ? (
                    <Link to="/race" search={{ id: raceId }} className="shrink-0 text-[11px] font-bold text-gold">
                      排位表 →
                    </Link>
                  ) : null}
                </div>
                {open ? <RunnerRoster race={race} meeting={meeting} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
