import { Fragment } from "react";
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
  runnerFormCells,
  runnerMeasures,
  showsDeclaredCard,
  type CardStatus,
  type Measure,
} from "@/lib/meeting-card";
import { canonicalHorseId, canonicalRaceId, type Meeting, type RaceHorse, type RaceSummary } from "@/lib/tx-api";

import { brandOf, profileForRunner, reservesForRace } from "@/lib/official-records";

import { OfficialLink, RaceFilesBlock, ReserveList, RunnerProfileStrip, useRacecardOfficial, type RacecardOfficial } from "./RacecardOfficial";
import { OfficialRunnerNotes, useMeetingOfficialNotes } from "./OfficialRunnerNotes";
import { raceVoidOf } from "@/lib/race-settlement-display";

import { RaceVoidNotice } from "./RaceVoidNotice";
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
      {label ? <Pill tone={status === "cancelled" ? "lose" : status === "declared" || status === "resulted" ? "gold" : "ink"}>{label}</Pill> : null}
      {draw ? <Pill>{draw}</Pill> : null}
    </span>
  );
}

/** 官方排位格：金框同排位表其餘灰格分開，字級沿用排位格。 */
export function RunnerFormStrip({ cells }: { cells: Measure[] }) {
  if (!cells.length) return null;
  const columns = cells.length > 4 ? "sm:grid-cols-3 lg:grid-cols-6" : "lg:grid-cols-4";
  return (
    <dl className={`mt-1.5 grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border border-gold-strong/45 bg-gold-strong/30 ${columns}`}>
      {cells.map((cell) => (
        <div key={cell.label} className="min-w-0 bg-paper px-1 py-1.5 text-center">
          <dt className="text-[11px] font-bold leading-tight text-ink-3">{cell.label}</dt>
          <dd className="tabnum mt-0.5 truncate font-mono-tx text-[11px] font-bold text-ink">{cell.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function raceDistance(race: RaceSummary): string {
  const metres = race.distance || race.distanceM;
  return metres ? `${metres}m` : "";
}

function RunnerRoster({
  race,
  meeting,
  official,
  notes,
}: {
  race: RaceSummary;
  meeting: Meeting;
  official: RacecardOfficial;
  notes: ReturnType<typeof useMeetingOfficialNotes>;
}) {
  const horses = race.horses || [];
  const voided = raceVoidOf(race);
  const status = effectiveCardStatus(race, meeting);
  const drawStatus = effectiveDrawStatus(race, meeting);
  const declared = showsDeclaredCard(status);
  if (voided && !horses.length) return <RaceVoidNotice race={voided} />;
  if (!horses.length) return <p className="py-2 text-[12px] text-ink-3">此場未有馬匹</p>;
  if (!declared) {
    return (
      <>
      {voided ? <RaceVoidNotice race={voided} /> : null}
      <ul className="divide-y divide-hairline">
        {horses.map((horse) => (
          <EntryRow key={horse.id || horse.code || horse.nameCh} horse={horse} />
        ))}
      </ul>
      </>
    );
  }
  const labels = ["檔位", imposedWeightLabel(race.title), "排位體重"];
  const raceNo = Number(race.raceNumber);
  return (
    <>
    <Scroller>
      <Table head={["馬匹", ...labels]}>
        {horses.map((horse) => {
          const row = runnerMeasures({ horse, title: race.title, cardStatus: status, drawStatus });
          const form = runnerFormCells({ horse, cardStatus: status });
          const name = horse.nameCh || horse.name || "未命名";
          const id = canonicalHorseId(horse.id);
          const profile = profileForRunner(official.profiles, raceNo, horse.horseNumber, brandOf(horse.code, horse.id));
          const facts = notes.factsFor({
            raceNo,
            horseNo: typeof horse.horseNumber === "number" ? horse.horseNumber : null,
            brand: brandOf(horse.code, horse.id),
            horseId: horse.id,
            reserve: false,
          });
          return (
            <Fragment key={horse.id || `${horse.horseNumber}-${name}`}>
              <tr className="border-b border-hairline">
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
              {form.length || profile || facts.length ? (
                <tr className="border-b border-hairline">
                  <td colSpan={labels.length + 1} className="px-1 pb-2">
                    <RunnerFormStrip cells={form} />
                    {profile ? <RunnerProfileStrip row={profile} /> : null}
                    <OfficialRunnerNotes facts={facts} />
                  </td>
                </tr>
              ) : null}
            </Fragment>
          );
        })}
      </Table>
    </Scroller>
    <ReserveList
      rows={reservesForRace(official.profiles, raceNo)}
      notesFor={(row) => notes.factsFor({ raceNo: row.raceNo, horseNo: row.horseNo, brand: row.brand, horseId: row.horseId, reserve: true })}
    />
    <div className="py-2">
      <RaceFilesBlock official={official} raceNo={raceNo} showAll={false} />
    </div>
    </>
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
  const official = useRacecardOfficial(meeting.date, meeting.venue, declared);
  const notes = useMeetingOfficialNotes(meeting.date, meeting.venue, official.enabled);
  return (
    <div className="pb-3 pl-1">
      {declared && official.files.allPdf ? (
        <p className="pb-1 text-[12px]"><OfficialLink href={official.files.allPdf}>全日排位 PDF（馬會官方）↗</OfficialLink></p>
      ) : null}
      {!races.length ? (
        <p className="py-2 text-[12px] text-ink-3">{meetingRacesEmptyLabel(status)}</p>
      ) : (
        <div className="divide-y divide-hairline border-l border-hairline pl-3">
          {races.map((race) => {
            const open = race.id === activeRaceId;
            const raceId = canonicalRaceId(race.id);
            const horses = race.horses || [];
            const voided = raceVoidOf(race);
            return (
              <div key={race.id}>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onRace(race.id)} className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left">
                    <span className="tabnum w-7 shrink-0 font-mono-tx text-[11px] font-bold text-gold">R{race.raceNumber}</span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">{race.title || `第 ${race.raceNumber} 場`}</span>
                    {voided ? <Pill tone="lose">{voided.label}</Pill> : (
                      <span className="tabnum shrink-0 font-mono-tx text-[11px] text-ink-3">
                        {[raceDistance(race), horses.length ? `${horses.length} 匹` : ""].filter(Boolean).join(" · ")}
                      </span>
                    )}
                  </button>
                  {(declared || voided) && raceId ? (
                    <Link to="/race" search={{ id: raceId }} className="shrink-0 text-[11px] font-bold text-gold">
                      {voided ? "場次 →" : "排位表 →"}
                    </Link>
                  ) : null}
                </div>
                {open ? <RunnerRoster race={race} meeting={meeting} official={official} notes={notes} /> : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
