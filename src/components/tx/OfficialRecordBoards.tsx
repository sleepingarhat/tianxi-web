import { useState } from "react";

import { filterRows, officialBoardPath, pageOf, type PolicyPage, type RatingBoard, type VenueCode } from "@/lib/official-boards";
import {
  RATING_BOARDS,
  groupNews,
  groupRacecardFiles,
  importPolicyLayout,
  officialStamp,
  profileCells,
  readNewsRows,
  readRacecardFiles,
  readRacecardProfiles,
  readRatingRows,
  readStatsPosters,
  type NewsRow,
  type PolicyBlock,
  type RacecardFile,
  type RacecardProfileRow,
  type RatingRow,
  type StatsPoster,
} from "@/lib/official-records";

import { BoardCard, Count, Pager, useBoard } from "./OfficialBoardParts";
import { OfficialImage, OfficialLink, TrackMapFigure } from "./RacecardOfficial";
import { Empty, Pill, Scroller, Seg, Table, Td } from "./ui";

const OFFICIAL_PILL = <Pill tone="gold">馬會官方</Pill>;

// ---------------------------------------------------------------------------
// 賽日數據海報
// ---------------------------------------------------------------------------

function PosterGrid({ rows }: { rows: StatsPoster[] }) {
  return (
    <>
      <p className="text-[11px] leading-relaxed text-ink-3">海報按馬會官方海報日期顯示，唔會跟你揀嘅賽日改變。</p>
      <ul className="mt-2 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <li key={row.slot} className="min-w-0">
            <p className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
              <span className="font-serif-tc font-bold text-ink">{row.label}</span>
              <span className="tabnum font-mono-tx text-[11px] text-ink-3">官方海報日期 {row.posterDate ?? "—"}</span>
            </p>
            <p className="tabnum mb-1 font-mono-tx text-[11px] text-ink-3">更新 {officialStamp(row.lastUpdate)} · 展示至 {officialStamp(row.windowEnd)}</p>
            {row.imageUrl ? (
              <OfficialImage src={row.imageUrl} alt={`馬會${row.label}海報 ${row.posterDate ?? ""}`} />
            ) : (
              <Empty label="官方圖片路徑未核對，暫不顯示。" />
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function StatsCentreBoard() {
  const path = officialBoardPath("stats-centre");
  const query = useBoard(path);
  return (
    <BoardCard id="stats-centre" title="賽日數據" en="Stats centre" action={OFFICIAL_PILL} path={path} query={query} read={readStatsPosters} render={(rows) => <PosterGrid rows={rows as StatsPoster[]} />} />
  );
}

// ---------------------------------------------------------------------------
// 馬匹評分
// ---------------------------------------------------------------------------

function RatingTable({ rows, board }: { rows: RatingRow[]; board: RatingBoard }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const filtered = filterRows(rows, query, (row) => `${row.nameCh} ${row.nameEn ?? ""} ${row.brand}`);
  const view = pageOf(filtered, page);
  const showTrainer = board === "tp50" || rows.some((row) => row.trainerName);
  const showMark = rows.some((row) => row.markText);
  const head = ["序", "馬名", "官方評分", "變動", ...(showMark ? ["標記"] : []), ...(showTrainer ? ["練馬師"] : [])];
  return (
    <>
      <Count n={filtered.length} />
      <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="馬名或烙號" aria-label="搜尋馬匹評分" className="tx-field mt-2 w-full" />
      {view.slice.length ? (
        <Scroller>
          <Table head={head}>
            {view.slice.map((row) => (
              <tr key={`${row.lineNo}-${row.brand}`}>
                <Td first><span className="tabnum font-mono-tx text-[11px] text-ink-3">{row.lineNo ?? "—"}</span></Td>
                <td className="px-1.5 py-1.5 text-left">
                  <span className="block font-serif-tc text-[12px] font-bold text-ink">{row.nameCh}</span>
                  <span className="tabnum block font-mono-tx text-[11px] text-ink-3">{[row.brand, row.nameEn].filter(Boolean).join(" · ")}</span>
                </td>
                <Td>{row.rating ?? "—"}</Td>
                <Td>{row.changeText ?? "—"}</Td>
                {showMark ? <Td>{row.markText ?? "—"}</Td> : null}
                {showTrainer ? <Td mono={false}>{row.trainerName ?? "—"}</Td> : null}
              </tr>
            ))}
          </Table>
        </Scroller>
      ) : (
        <Empty label="沒有符合嘅馬匹。" />
      )}
      <Pager page={view.page} pages={view.pages} onPage={setPage} />
    </>
  );
}

export function HorseRatingsBoard() {
  const [board, setBoard] = useState<RatingBoard>("clas");
  const path = officialBoardPath("horse-ratings", { ratingBoard: board });
  const query = useBoard(path);
  return (
    <BoardCard
      id="horse-ratings"
      title="馬匹評分"
      en="Horse ratings"
      action={OFFICIAL_PILL}
      toolbar={<Seg value={board} onChange={setBoard} options={RATING_BOARDS} />}
      path={path}
      query={query}
      read={readRatingRows}
      render={(rows) => <RatingTable key={board} rows={rows as RatingRow[]} board={board} />}
    />
  );
}

// ---------------------------------------------------------------------------
// 馬匹消息
// ---------------------------------------------------------------------------

function NewsList({ rows }: { rows: NewsRow[] }) {
  const groups = groupNews(rows);
  const [picked, setPicked] = useState(groups[0]?.view ?? "");
  const group = groups.find((item) => item.view === picked) ?? groups[0];
  if (!group) return <Empty label="呢個範圍未有收錄。" />;
  return (
    <>
      <Seg value={group.view} onChange={setPicked} options={groups.map((item) => ({ value: item.view, label: item.label }))} />
      <p className="mt-2 text-[11px] text-ink-3">{group.label} · 共 {group.rows.length} 條 · 官方檔案只提供外連</p>
      <ul className="mt-1 divide-y divide-hairline">
        {group.rows.map((row) => (
          <li key={`${row.view}-${row.lineNo}-${row.title}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-2 py-2">
            <div className="min-w-0">
              <p className="text-[12px] leading-relaxed text-ink">{row.title}</p>
              <p className="tabnum font-mono-tx text-[11px] text-ink-3">發布 {officialStamp(row.publishedAt)}{row.fileDate ? ` · 檔案日期 ${row.fileDate}` : ""}</p>
            </div>
            <span className="shrink-0 text-[12px]">
              {row.fileUrl ? <OfficialLink href={row.fileUrl}>官方檔案 ↗</OfficialLink> : <span className="text-[11px] text-ink-3">檔案未核對</span>}
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

export function HorseNewsBoard() {
  const path = officialBoardPath("horse-news");
  const query = useBoard(path);
  return (
    <BoardCard id="horse-news" title="馬匹消息" en="Horse news" action={OFFICIAL_PILL} path={path} query={query} read={readNewsRows} render={(rows) => <NewsList rows={rows as NewsRow[]} />} />
  );
}

// ---------------------------------------------------------------------------
// 進口資格
// ---------------------------------------------------------------------------

function PolicyTable({ rows }: { rows: string[][] }) {
  const width = Math.max(1, ...rows.map((row) => row.length));
  return (
    <Scroller>
      <table className="my-2 w-full border-collapse text-[12px]">
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {Array.from({ length: width }, (_, c) => (
                <td key={c} className="border border-hairline bg-paper px-2 py-1.5 align-top leading-relaxed text-ink-2 whitespace-pre-line">{row[c] ?? ""}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Scroller>
  );
}

function PolicyBody({ blocks }: { blocks: PolicyBlock[] }) {
  return (
    <div className="space-y-1.5">
      {blocks.map((block, index) =>
        block.type === "paragraph" ? (
          <p key={index} className="whitespace-pre-line text-[12px] leading-relaxed text-ink-2">{block.text}</p>
        ) : (
          <PolicyTable key={index} rows={block.rows} />
        ),
      )}
    </div>
  );
}

export function ImportPolicyBoard() {
  const [page, setPage] = useState<PolicyPage>("pps");
  const path = officialBoardPath("import-policy", { policyPage: page });
  const query = useBoard(path);
  const layout = query.data ? importPolicyLayout(query.data, page) : null;
  const tabs: { value: PolicyPage; label: string }[] = (["pps", "ppgs"] as const).map((value) => ({
    value,
    label: layout?.tabs.find((tab) => tab.page === value)?.label ?? (value === "pps" ? "自購馬" : "自購新馬"),
  }));
  return (
    <BoardCard
      id="import-policy"
      title="進口資格"
      en="Import criteria"
      action={OFFICIAL_PILL}
      toolbar={<Seg value={page} onChange={setPage} options={tabs} />}
      path={path}
      query={query}
      read={(envelope) => {
        const current = importPolicyLayout(envelope, page);
        return current.blocks.length ? [current] : [];
      }}
      render={(rows) => {
        const current = rows[0] as ReturnType<typeof importPolicyLayout>;
        return (
          <>
            {current.imageUrl ? <div className="mb-2 max-w-[420px]"><OfficialImage src={current.imageUrl} alt="馬會進口資格標題圖" /></div> : null}
            <PolicyBody blocks={current.blocks} />
            {current.exam ? (
              <p className="mt-3 text-[12px]">
                {current.exam.url ? <OfficialLink href={current.exam.url}>{current.exam.text} ↗</OfficialLink> : <span className="text-ink-2">{current.exam.text}</span>}
              </p>
            ) : null}
          </>
        );
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// 排位馬匹資料（賽日）
// ---------------------------------------------------------------------------

function ProfileTable({ rows }: { rows: RacecardProfileRow[] }) {
  const races = [...new Set(rows.map((row) => row.raceNo))].sort((a, b) => a - b);
  const [race, setRace] = useState(races[0] ?? 1);
  const picked = races.includes(race) ? race : races[0] ?? 1;
  const list = rows
    .filter((row) => row.raceNo === picked)
    .sort((a, b) => Number(a.reserve) - Number(b.reserve) || (a.horseNo ?? 99) - (b.horseNo ?? 99));
  const starters = rows.filter((row) => !row.reserve).length;
  return (
    <>
      <p className="text-[11px] text-ink-3">共 {starters} 匹出賽 · {rows.length - starters} 匹後備</p>
      <div className="mt-2"><Seg value={picked} onChange={setRace} options={races.map((value) => ({ value, label: `第${value}場` }))} /></div>
      <Scroller>
        <Table head={["馬號", "馬匹", "年齡", "性別", "季內獎金", "進口類別", "馬主", "父系／母系"]}>
          {list.map((row) => {
            const cells = profileCells(row);
            const value = (label: string) => [...cells.short, ...cells.long].find((cell) => cell.label === label)?.value ?? "—";
            return (
              <tr key={`${row.reserve ? "r" : "s"}-${row.horseNo}-${row.brand ?? row.horseName}`}>
                <Td first>{row.reserve ? <Pill>後備{row.horseNo ?? ""}</Pill> : <span className="tabnum font-mono-tx">{row.horseNo ?? "—"}</span>}</Td>
                <td className="px-1.5 py-1.5 text-left">
                  <span className="block whitespace-nowrap font-serif-tc text-[12px] font-bold text-ink">{row.horseName}</span>
                  <span className="tabnum block font-mono-tx text-[11px] text-ink-3">{row.brand ?? "—"}</span>
                </td>
                <Td>{value("年齡")}</Td>
                <Td mono={false}>{value("性別")}</Td>
                <Td>{value("季內獎金")}</Td>
                <Td>{value("進口類別")}</Td>
                <Td mono={false} className="max-w-[220px] whitespace-normal text-left">{value("馬主")}</Td>
                <Td mono={false} className="text-left">{value("父系")} ／ {value("母系")}</Td>
              </tr>
            );
          })}
        </Table>
      </Scroller>
    </>
  );
}

export function RacecardProfileBoard({ date, venue }: { date: string; venue: VenueCode }) {
  const path = officialBoardPath("racecard-profile", { date, venue });
  const query = useBoard(path);
  return (
    <BoardCard id="racecard-profile" title="排位馬匹資料" en="Racecard profile" path={path} query={query} read={readRacecardProfiles} render={(rows) => <ProfileTable rows={rows as RacecardProfileRow[]} />} />
  );
}

function FilesList({ rows }: { rows: RacecardFile[] }) {
  const grouped = groupRacecardFiles(rows);
  return (
    <>
      <Count n={rows.length} />
      {grouped.allPdf ? <p className="mt-2 text-[12px]"><OfficialLink href={grouped.allPdf}>全日排位 PDF ↗</OfficialLink></p> : null}
      <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {grouped.races.map((race) => (
          <li key={race.raceNo} className="min-w-0">
            <TrackMapFigure race={race} />
            {race.pdf ? <p className="mt-1 text-[12px]"><OfficialLink href={race.pdf}>第{race.raceNo}場排位 PDF ↗</OfficialLink></p> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

export function RacecardFilesBoard({ date, venue }: { date: string; venue: VenueCode }) {
  const path = officialBoardPath("racecard-files", { date, venue });
  const query = useBoard(path);
  return (
    <BoardCard id="racecard-files" title="排位檔案及跑道圖" en="Racecard files" path={path} query={query} read={readRacecardFiles} render={(rows) => <FilesList rows={rows as RacecardFile[]} />} />
  );
}
