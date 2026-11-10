import { useState, type ReactNode } from "react";

import { asVenue, emptyBoardLabel, officialBoardPath } from "@/lib/official-boards";
import {
  groupRacecardFiles,
  profileCells,
  readRacecardFiles,
  readRacecardProfiles,
  trackMapCaption,
  type RaceFiles,
  type RacecardProfileRow,
} from "@/lib/official-records";

import { useBoard } from "./OfficialBoardParts";

/** 官方圖片：只收已核對嘅官方網址。圖顯示唔到都保留可打開嘅連結。 */
export function OfficialImage({ src, href, alt, className = "" }: { src: string; href?: string | null; alt: string; className?: string }) {
  const [broken, setBroken] = useState(false);
  const target = href ?? src;
  if (broken) {
    return (
      <a href={target} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="block rounded-[6px] border border-dashed border-hairline bg-paper px-3 py-4 text-center text-[12px] font-bold text-gold underline underline-offset-2">
        圖片暫時載入唔到，開官方原圖 ↗
      </a>
    );
  }
  return (
    <a href={target} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="block rounded-[6px] border border-hairline bg-paper p-1">
      <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setBroken(true)} className={`w-full rounded-[4px] bg-paper-2 object-contain ${className}`} />
    </a>
  );
}

export function OfficialLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="font-bold text-gold underline underline-offset-2">
      {children}
    </a>
  );
}

/** 只喺正式排位或完場賽日讀；已報名唔發請求。 */
export function useRacecardOfficial(date: string | null | undefined, venue: string | null | undefined, enabled: boolean) {
  const v = asVenue(venue);
  const meeting = date && v ? { date, venue: v } : null;
  const profilePath = enabled && meeting ? officialBoardPath("racecard-profile", meeting) : null;
  const filesPath = enabled && meeting ? officialBoardPath("racecard-files", meeting) : null;
  const profile = useBoard(profilePath);
  const files = useBoard(filesPath);
  return {
    enabled: profilePath != null,
    profiles: profile.data ? readRacecardProfiles(profile.data) : [],
    profileAvailable: profile.data?.available ?? null,
    profileLoading: profilePath != null && profile.isPending,
    profileError: profile.isError,
    files: files.data ? groupRacecardFiles(readRacecardFiles(files.data)) : { allPdf: null, races: [] as RaceFiles[] },
    filesAvailable: files.data?.available ?? null,
    filesLoading: filesPath != null && files.isPending,
    filesError: files.isError,
  };
}

export type RacecardOfficial = ReturnType<typeof useRacecardOfficial>;

/** 每匹出賽馬嘅官方排位資料；同金框六格分開，用灰框。 */
export function RunnerProfileStrip({ row }: { row: RacecardProfileRow }) {
  const cells = profileCells(row);
  return (
    <div className="mt-1.5 grid gap-1 rounded-[6px] border border-hairline bg-paper px-2 py-1.5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start lg:gap-3">
      <dl className="grid grid-cols-4 gap-x-2 gap-y-1">
        {cells.short.map((cell) => (
          <div key={cell.label} className="min-w-0">
            <dt className="text-[11px] leading-tight text-ink-3">{cell.label}</dt>
            <dd className="tabnum truncate font-mono-tx text-[11px] font-bold text-ink">{cell.value}</dd>
          </div>
        ))}
      </dl>
      <dl className="space-y-0.5 text-[11px] leading-relaxed lg:grid lg:grid-cols-3 lg:gap-x-2 lg:space-y-0">
        {cells.long.map((cell) => (
          <div key={cell.label} className="flex min-w-0 gap-1.5 lg:block">
            <dt className="shrink-0 text-ink-3 lg:leading-tight">{cell.label}</dt>
            <dd className="min-w-0 [overflow-wrap:anywhere] text-ink-2">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function ReserveList({ rows }: { rows: RacecardProfileRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-2 rounded-[6px] border border-hairline bg-paper-2 px-2 py-2">
      <p className="text-[11px] font-bold text-ink-3">後備馬匹（馬會官方排位表）</p>
      <ul className="mt-1 divide-y divide-hairline">
        {rows.map((row) => (
          <li key={`${row.raceNo}-${row.horseNo}-${row.brand ?? row.horseName}`} className="py-1.5">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12px]">
              <span className="rounded-[4px] border border-hairline px-1 text-[11px] font-bold text-ink-2">後備{row.horseNo ?? ""}</span>
              <span className="font-serif-tc font-bold text-ink">{row.horseName}</span>
              {row.brand ? <span className="tabnum font-mono-tx text-[11px] text-ink-3">{row.brand}</span> : null}
            </p>
            <RunnerProfileStrip row={row} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TrackMapFigure({ race }: { race: RaceFiles }) {
  const src = race.thumb ?? race.map;
  if (!src) return null;
  const caption = trackMapCaption(race);
  return (
    <figure className="min-w-0">
      <OfficialImage src={src} href={race.map ?? race.thumb} alt={`第${race.raceNo}場跑道圖${caption ? ` ${caption}` : ""}`} className="max-h-40" />
      <figcaption className="mt-1 text-[11px] text-ink-3">第{race.raceNo}場跑道圖{caption ? ` · ${caption}` : ""}</figcaption>
    </figure>
  );
}

/** 單場排位附件：本場 PDF、全日 PDF 同跑道圖。 */
export function RaceFilesBlock({ official, raceNo, showAll = true }: { official: RacecardOfficial; raceNo: number; showAll?: boolean }) {
  if (!official.enabled) return null;
  if (official.filesLoading) return <p className="py-1 text-[11px] text-ink-3">讀取官方排位檔案…</p>;
  if (official.filesError) return <p className="py-1 text-[11px] text-ink-3">暫時讀唔到官方排位檔案。</p>;
  const race = official.files.races.find((item) => item.raceNo === raceNo);
  const allPdf = showAll ? official.files.allPdf : null;
  if (!race && !allPdf) return <p className="py-1 text-[11px] text-ink-3">官方排位檔案：{emptyBoardLabel(official.filesAvailable ?? false)}</p>;
  return (
    <div className="space-y-2">
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
        {race?.pdf ? <OfficialLink href={race.pdf}>第{raceNo}場排位 PDF ↗</OfficialLink> : null}
        {allPdf ? <OfficialLink href={allPdf}>全日排位 PDF ↗</OfficialLink> : null}
      </p>
      {race ? <div className="max-w-[280px]"><TrackMapFigure race={race} /></div> : null}
    </div>
  );
}
