import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  asDate,
  asLocalBrand,
  officialBoardPath,
  readFinishPhotos,
  type DirectoryBoardId,
  type MeetingBoardId,
  type VenueCode,
} from "@/lib/official-boards";
import {
  DIRECTORY_SURFACES,
  MEETING_SURFACES,
  OFFICIAL_GAP_NOTE,
  OFFICIAL_SURFACES,
  finishPhotoGaps,
  officialSurfaceMeta,
  raceListLabel,
  ratingForBrand,
  surfaceNeedsMeeting,
  type OfficialSurface,
} from "@/lib/official-library";
import { brandOf, groupRacecardFiles, readRacecardFiles, readRatingRows } from "@/lib/official-records";

import { useBoard } from "./OfficialBoardParts";
import { DirectoryOfficialBoards, MeetingOfficialBoards } from "./OfficialBoards";
import { RacecardFilesBoard, RacecardProfileBoard } from "./OfficialRecordBoards";
import { Card, Empty, Seg } from "./ui";

const MEETING_TEXT: { id: MeetingBoardId; label: string }[] = [
  { id: "ove-record", label: "獸醫檢查" },
  { id: "conghua-movement", label: "從化往來" },
  { id: "jt-combo", label: "騎練合作" },
  { id: "fwb-declared", label: "特別獎金" },
  { id: "challenge-odds", label: "騎師王／練馬師王" },
];

const DIRECTORY_OF: Partial<Record<OfficialSurface, DirectoryBoardId>> = {
  ratings: "horse-ratings",
  news: "horse-news",
  stats: "stats-centre",
  notes: "special-index",
  former: "horse-former-name",
  vet: "ove-database",
  ppo: "ppo-performance",
  policy: "import-policy",
};

export type OfficialSearch = {
  surface?: OfficialSurface | undefined;
  date?: string | undefined;
  venue?: VenueCode | undefined;
  raceNo?: number | undefined;
  board?: MeetingBoardId | undefined;
  brand?: string | undefined;
};

function kept(search: OfficialSearch): OfficialSearch {
  return {
    ...(search.surface ? { surface: search.surface } : {}),
    ...(search.date ? { date: search.date } : {}),
    ...(search.venue ? { venue: search.venue } : {}),
    ...(search.raceNo ? { raceNo: search.raceNo } : {}),
    ...(search.board ? { board: search.board } : {}),
    ...(search.brand ? { brand: search.brand } : {}),
  };
}

function chip(on: boolean) {
  return `inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-[12px] font-bold ${on ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2"}`;
}

function SurfaceNav({ search }: { search: OfficialSearch }) {
  const base = { date: search.date, venue: search.venue, raceNo: search.raceNo, brand: search.brand };
  return (
    <nav aria-label="官方資料分類" className="mx-4 mt-3 flex flex-wrap gap-1">
      <Link to="/official" search={kept({ ...base })} className={chip(!search.surface)}>全部</Link>
      {OFFICIAL_SURFACES.map((item) => (
        <Link key={item.id} to="/official" search={kept({ ...base, surface: item.id, board: item.id === "meeting" ? search.board : undefined })} className={chip(search.surface === item.id)}>
          {item.title}
        </Link>
      ))}
    </nav>
  );
}

function MeetingPicker({
  date,
  venue,
  onOpen,
}: {
  date: string;
  venue: VenueCode;
  onOpen: (date: string, venue: VenueCode) => void;
}) {
  const [draftDate, setDraftDate] = useState(date);
  const [draftVenue, setDraftVenue] = useState<VenueCode>(venue);
  useEffect(() => {
    setDraftDate(date);
    setDraftVenue(venue);
  }, [date, venue]);
  return (
    <Card title="賽事日" en="Meeting">
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          const next = asDate(draftDate);
          if (next) onOpen(next, draftVenue);
        }}
      >
        <label className="block min-w-0 flex-1 text-[11px] text-ink-3">
          日期
          <input type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className="tx-field mt-1 w-full" />
        </label>
        <div className="min-w-0">
          <p className="text-[11px] text-ink-3">馬場</p>
          <div className="mt-1">
            <Seg value={draftVenue} onChange={setDraftVenue} options={[{ value: "ST", label: "沙田" }, { value: "HV", label: "跑馬地" }]} />
          </div>
        </div>
        <button type="submit" className="h-8 rounded-full border border-hairline bg-paper px-3 text-[12px] font-bold text-ink">顯示呢個賽日</button>
      </form>
    </Card>
  );
}

function PhotoCoverage({ date, venue }: { date: string; venue: VenueCode }) {
  const photos = useBoard(officialBoardPath("finish-photos", { date, venue }));
  const files = useBoard(officialBoardPath("racecard-files", { date, venue }));
  if (photos.isPending || files.isPending) return <p className="mx-4 mt-2 text-[11px] text-ink-3">核對終點照片覆蓋…</p>;
  if (photos.isError || !photos.data) return null;
  if (!photos.data.available) return <p className="mx-4 mt-2 text-[12px] text-ink-2">暫時未有終點照片。未收錄唔會補相。</p>;
  const collectedRaces = readFinishPhotos(photos.data).map((row) => row.raceNo);
  const indexed = files.data?.available ? groupRacecardFiles(readRacecardFiles(files.data)).races.map((race) => race.raceNo) : [];
  const gaps = finishPhotoGaps(collectedRaces, indexed);
  const collected = gaps.collected.length ? `已收錄${raceListLabel(gaps.collected)}。` : "呢個賽日未有終點照片。";
  const missing = gaps.missing.length
    ? `${raceListLabel(gaps.missing)}未有終點照片。`
    : indexed.length
      ? "已收錄嘅排位場次都有終點照片。"
      : "排位場次未有索引，未列出嘅場次就係未收錄。";
  return <p className="mx-4 mt-2 text-[12px] leading-relaxed text-ink-2">{collected}{missing}</p>;
}

function Catalog({ search }: { search: OfficialSearch }) {
  const base = { date: search.date, venue: search.venue };
  return (
    <>
      {search.date && search.venue ? (
        <p className="mx-4 mt-3 text-[12px] text-ink-2">已揀 {search.date} · {search.venue === "ST" ? "沙田" : "跑馬地"}。下面賽日項目會帶住呢個賽日。</p>
      ) : (
        <p className="mx-4 mt-3 text-[12px] text-ink-2">賽日項目要先揀日期同馬場。未揀之前唔會當冇資料。</p>
      )}
      <section className="mx-4 mt-3">
        <h2 className="font-serif-tc text-[15px] font-bold text-ink">賽日</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {MEETING_SURFACES.map((item) => (
            <li key={item.id}>
              <Link to="/official" search={kept({ ...base, surface: item.id })} className="block h-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-3">
                <span className="font-serif-tc text-[14px] font-bold text-ink">{item.title}</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-ink-2">{item.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="mx-4 mt-4">
        <h2 className="font-serif-tc text-[15px] font-bold text-ink">名冊</h2>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {DIRECTORY_SURFACES.map((item) => (
            <li key={item.id}>
              <Link to="/official" search={kept({ surface: item.id, brand: search.brand })} className="block h-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-3">
                <span className="font-serif-tc text-[14px] font-bold text-ink">{item.title}</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-ink-2">{item.blurb}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <p className="mx-4 mt-3 text-[12px] leading-relaxed text-ink-3">{OFFICIAL_GAP_NOTE}</p>
      <p className="mx-4 mt-1 text-[12px]">
        <Link to="/official-pools" className="font-bold text-gold underline underline-offset-2">官方派彩 →</Link>
        <Link
          to="/official-boards"
          search={{
            ...(search.date ? { date: search.date } : {}),
            ...(search.venue ? { venue: search.venue } : {}),
            scope: search.date && search.venue ? "meeting" : "directory",
          }}
          className="ml-3 font-bold text-gold underline underline-offset-2"
        >
          舊版一頁板面 →
        </Link>
      </p>
    </>
  );
}

function MeetingSurface({ search, onSearch }: { search: OfficialSearch; onSearch: (next: OfficialSearch) => void }) {
  if (!search.surface || !surfaceNeedsMeeting(search.surface)) return null;
  const date = search.date;
  const venue = search.venue ?? "ST";
  const board = search.board && MEETING_TEXT.some((item) => item.id === search.board) ? search.board : "ove-record";
  return (
    <>
      <MeetingPicker date={date ?? ""} venue={venue} onOpen={(nextDate, nextVenue) => onSearch({ ...search, date: nextDate, venue: nextVenue })} />
      {date && search.venue ? (
        <>
          {search.surface === "photos" ? (
            <>
              <PhotoCoverage date={date} venue={search.venue} />
              <MeetingOfficialBoards date={date} venue={search.venue} raceNo={search.raceNo} only="finish-photos" />
            </>
          ) : null}
          {search.surface === "files" ? <RacecardFilesBoard date={date} venue={search.venue} /> : null}
          {search.surface === "profile" ? <RacecardProfileBoard date={date} venue={search.venue} /> : null}
          {search.surface === "meeting" ? (
            <>
              <div className="mx-4 mt-3">
                <Seg
                  wrap
                  value={board}
                  onChange={(next) => onSearch({ ...search, board: next })}
                  options={MEETING_TEXT.map((item) => ({ value: item.id, label: item.label }))}
                />
              </div>
              <MeetingOfficialBoards date={date} venue={search.venue} only={board} />
            </>
          ) : null}
        </>
      ) : (
        <Card title="未揀賽事日" en="Choose a meeting">
          <p className="text-[12px] leading-relaxed text-ink-2">揀日期同馬場之後先讀{officialSurfaceMeta(search.surface).title}。未揀之前唔會當冇資料。</p>
        </Card>
      )}
    </>
  );
}

export function OfficialLibrary({ search, onSearch }: { search: OfficialSearch; onSearch: (next: OfficialSearch) => void }) {
  const directory = search.surface ? DIRECTORY_OF[search.surface] : undefined;
  return (
    <>
      <SurfaceNav search={search} />
      {!search.surface ? <Catalog search={search} /> : null}
      {directory ? (
        <DirectoryOfficialBoards
          embedded
          board={directory}
          brand={search.surface === "former" ? search.brand : undefined}
          onBoard={() => undefined}
        />
      ) : null}
      {search.surface && surfaceNeedsMeeting(search.surface) ? <MeetingSurface search={search} onSearch={onSearch} /> : null}
    </>
  );
}

function ratingLine(label: string, pending: boolean, failed: boolean, text: string | null, empty: string) {
  return (
    <p className="text-[12px] leading-relaxed text-ink-2">
      <span className="font-bold text-ink-3">{label}</span>
      {" "}
      {pending ? "讀取中…" : failed ? "暫時讀唔到。" : text ?? empty}
    </p>
  );
}

/** 馬匹頁：三張公開評分榜入面，烙號完全相符先顯示。 */
export function HorseRatingListCard({ code }: { code: string }) {
  const brand = brandOf(code) ?? asLocalBrand(code);
  const clas = useBoard(brand ? officialBoardPath("horse-ratings", { ratingBoard: "clas" }) : null);
  const csum = useBoard(brand ? officialBoardPath("horse-ratings", { ratingBoard: "csum" }) : null);
  const top = useBoard(brand ? officialBoardPath("horse-ratings", { ratingBoard: "tp50" }) : null);
  const listed = (query: typeof clas, format: (row: ReturnType<typeof readRatingRows>[number]) => string) => {
    if (!query.data || !query.data.available) return null;
    const row = ratingForBrand(readRatingRows(query.data), brand);
    if (!row) return "未收錄呢匹馬";
    return format(row);
  };
  return (
    <Card title="馬會評分榜" en="Current ratings list" action={<Link to="/official" search={{ surface: "ratings" }} className="text-[12px] font-bold text-gold">評分榜 →</Link>}>
      {!brand ? (
        <Empty label="呢個烙號唔係評分榜用嘅單字母格式，所以冇對照。" />
      ) : (
        <>
          <p className="tabnum mb-1 font-mono-tx text-[12px] text-gold">{brand}</p>
          {ratingLine("評分榜", clas.isPending, clas.isError, listed(clas, (row) => row.rating != null ? String(row.rating) : "—"), "暫時未有評分榜。")}
          {ratingLine("評分變動", csum.isPending, csum.isError, listed(csum, (row) => [row.changeText, row.rating != null ? `現評 ${row.rating}` : "", row.markText].filter(Boolean).join(" · ") || "—"), "暫時未有評分變動。")}
          {ratingLine("最高評分", top.isPending, top.isError, listed(top, (row) => row.rating != null ? String(row.rating) : "—"), "暫時未有最高評分。")}
        </>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-ink-3">官方現行評分榜，唔係逐場歷史，亦唔會用作預測。</p>
    </Card>
  );
}
