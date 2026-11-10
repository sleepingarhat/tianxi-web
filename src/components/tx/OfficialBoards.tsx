import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import {
  challengeRaceLabel,
  emptyBoardLabel,
  filterRows,
  formatOfficialRate,
  groupChallenge,
  officialBoardPath,
  pageOf,
  ppoSeasons,
  readChallengeRows,
  readConghuaRows,
  readFinishPhotos,
  readFormerNames,
  readFwbRows,
  readJtRows,
  readOveRows,
  readPpoRows,
  readSpecialIndex,
  asLocalBrand,
  type ChallengeRow,
  type ConghuaRow,
  type DirectoryBoardId,
  type FinishPhotoRow,
  type FormerNameRow,
  type FwbRow,
  type JtRow,
  type MeetingBoardId,
  type OfficialEnvelope,
  type OveRow,
  type PpoRow,
  type SpecialIndexRow,
  type VenueCode,
} from "@/lib/official-boards";

import { BoardCard, Count, Pager, note, useBoard } from "./OfficialBoardParts";
import { HorseNewsBoard, HorseRatingsBoard, ImportPolicyBoard, RacecardFilesBoard, RacecardProfileBoard, StatsCentreBoard } from "./OfficialRecordBoards";
import { Card, Empty, ErrorNote, Loading, Pill, Scroller, Seg, Table, Td } from "./ui";

function horseLine(raceNo: number | null, horseNo: number | null, name: string, extra?: string | null) {
  return (
    <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12px]">
      {raceNo != null ? <span className="tabnum font-mono-tx text-ink-3">第{raceNo}場</span> : null}
      {horseNo != null ? <span className="tabnum font-mono-tx text-ink-3">{horseNo}號</span> : null}
      <span className="font-serif-tc font-bold text-ink">{name}</span>
      {extra ? <span className="text-[11px] text-ink-3">{extra}</span> : null}
    </p>
  );
}

function OveList({ rows }: { rows: OveRow[] }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const filtered = filterRows(rows, query, (row) => `${row.horseName} ${row.horseCode ?? ""} ${row.detail}`);
  const view = pageOf(filtered, page);
  return (
    <>
      <Count n={filtered.length} />
      {rows.length > 12 ? (
        <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="馬名或烙號" aria-label="篩選獸醫檢查" className="tx-field mt-2 w-full" />
      ) : null}
      <ul className="mt-2 divide-y divide-hairline">
        {view.slice.map((row) => (
          <li key={`${row.raceNo ?? "db"}-${row.lineNo ?? row.horseCode}-${row.horseName}`} className="py-2">
            {horseLine(row.raceNo, row.horseNo, row.horseName, [row.horseCode, row.reserve ? "後備" : ""].filter(Boolean).join(" · "))}
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{row.detail}</p>
            <p className="mt-1 text-[11px] text-ink-3">
              {row.injuryDate ? `日期 ${row.injuryDate}` : "日期 —"}
              {row.passedDate ? ` · 通過 ${row.passedDate}` : ""}
            </p>
          </li>
        ))}
      </ul>
      {!view.slice.length ? <Empty label="沒有符合嘅紀錄。" /> : null}
      <Pager page={view.page} pages={view.pages} onPage={setPage} />
    </>
  );
}

function ConghuaList({ rows }: { rows: ConghuaRow[] }) {
  const [page, setPage] = useState(1);
  const view = pageOf(rows, page);
  return (
    <>
      <Count n={rows.length} />
      <ul className="mt-2 divide-y divide-hairline">
        {view.slice.map((row) => (
          <li key={`${row.raceNo}-${row.horseNo}-${row.horseNameCh}`} className="py-2">
            {horseLine(row.raceNo, row.horseNo, row.horseNameCh, row.reserve ? "後備" : row.horseNameEn)}
            <p className="mt-1 text-[11px] text-ink-3">抵埗 {row.arrivedDate ?? "—"} · 返回 {row.returnedDate ?? "—"}</p>
          </li>
        ))}
      </ul>
      <Pager page={view.page} pages={view.pages} onPage={setPage} />
    </>
  );
}

function JtList({ rows }: { rows: JtRow[] }) {
  const combo = rows.filter((row) => row.section === "combo");
  const debut = rows.filter((row) => row.section === "debut");
  const [page, setPage] = useState(1);
  const view = pageOf(combo, page);
  return (
    <>
      <Count n={rows.length} />
      {debut.length ? (
        <div className="mt-2">
          <p className="text-[12px] font-bold text-ink">初出</p>
          <ul className="mt-1 divide-y divide-hairline">
            {debut.map((row) => (
              <li key={`debut-${row.raceNo}-${row.horseNo}`} className="py-2">
                {horseLine(row.raceNo, row.horseNo, row.horseName ?? "—", [row.importType, row.trainerName].filter(Boolean).join(" · "))}
                <p className="mt-1 tabnum font-mono-tx text-[11px] text-ink-2">勝出 {formatOfficialRate(row.winRate)} · 位置 {formatOfficialRate(row.placeRate)}{row.asOfText ? ` · 截至 ${row.asOfText}` : ""}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {combo.length ? (
        <div className="mt-3">
          <p className="text-[12px] font-bold text-ink">騎練合作</p>
          <Scroller>
            <Table head={["場次", "馬號", "勝出", "位置", "截至"]}>
              {view.slice.map((row) => (
                <tr key={`combo-${row.raceNo}-${row.horseNo}`}>
                  <Td first>第{row.raceNo}場</Td>
                  <Td>{row.horseNo ?? "—"}</Td>
                  <Td>{formatOfficialRate(row.winRate)}</Td>
                  <Td>{formatOfficialRate(row.placeRate)}</Td>
                  <Td>{row.asOfText ?? "—"}</Td>
                </tr>
              ))}
            </Table>
          </Scroller>
          <Pager page={view.page} pages={view.pages} onPage={setPage} />
        </div>
      ) : null}
    </>
  );
}

function FwbList({ rows }: { rows: FwbRow[] }) {
  return (
    <>
      <Count n={rows.length} />
      <ul className="mt-2 divide-y divide-hairline">
        {rows.map((row) => (
          <li key={`${row.raceNo}-${row.horseNo}-${row.brand}`} className="py-2">
            {horseLine(row.raceNo, row.horseNo, row.horseNameCh, [row.brand, row.reserve ? "後備" : ""].filter(Boolean).join(" · "))}
            <p className="mt-1 text-[12px] leading-relaxed text-ink-2">{row.bonusCh}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function PhotoGrid({ rows }: { rows: FinishPhotoRow[] }) {
  return (
    <>
      <Count n={rows.length} />
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <li key={row.imagePath}>
            <a href={row.imagePath} target="_blank" rel="noreferrer" referrerPolicy="no-referrer" className="block rounded-[6px] border border-hairline bg-paper p-1">
              <img src={row.imagePath} alt={`第${row.raceNo}場終點照片 ${row.photoCode}`} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="aspect-[4/3] w-full rounded-[4px] bg-paper-2 object-contain" />
              <span className="mt-1 block text-[11px] font-bold text-gold">第{row.raceNo}場 {row.photoCode}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

function ChallengeTable({ rows }: { rows: ChallengeRow[] }) {
  const groups = groupChallenge(rows);
  const updated = rows.find((row) => row.chartUpdatedAt)?.chartUpdatedAt;
  return (
    <>
      <Count n={rows.length} />
      {updated ? <p className="mt-1 text-[11px] text-ink-3">圖表更新 {updated}</p> : null}
      {groups.map((group) => {
        const races = [...new Set(group.people.flatMap((person) => person.cells.map((cell) => cell.raceNo)))].sort((a, b) => a - b);
        return (
          <div key={group.pool} className="mt-3">
            <p className="text-[12px] font-bold text-ink">{group.label}</p>
            <Scroller>
              <Table head={["名稱", "積分", ...races.map((raceNo) => challengeRaceLabel(raceNo) || "—")]}>
                {group.people.map((person) => (
                  <tr key={`${person.pool}-${person.winnerCode}`}>
                    <Td first>{person.winnerName}</Td>
                    <Td>{person.points ?? "—"}</Td>
                    {races.map((raceNo) => (
                      <Td key={raceNo}>{person.cells.find((cell) => cell.raceNo === raceNo)?.oddsText ?? "—"}</Td>
                    ))}
                  </tr>
                ))}
              </Table>
            </Scroller>
          </div>
        );
      })}
    </>
  );
}

function SpecialList({ rows }: { rows: SpecialIndexRow[] }) {
  return (
    <>
      <Count n={rows.length} />
      <ul className="mt-2 divide-y divide-hairline">
        {rows.map((row) => (
          <li key={row.code} className="flex items-baseline gap-2 py-2">
            <span className="tabnum w-14 shrink-0 font-mono-tx text-[12px] font-bold text-gold">{row.code}</span>
            <span className="text-[12px] leading-relaxed text-ink">{row.noteCh}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function FormerList({ rows }: { rows: FormerNameRow[] }) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const filtered = filterRows(rows, query, (row) => `${row.nameCh} ${row.nameEn ?? ""} ${row.formerName ?? ""} ${row.brand}`);
  const view = pageOf(filtered, page);
  return (
    <>
      <Count n={filtered.length} />
      <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="馬名、曾用名或烙號" aria-label="篩選曾用名" className="tx-field mt-2 w-full" />
      <ul className="mt-2 divide-y divide-hairline">
        {view.slice.map((row) => (
          <li key={`${row.brand}-${row.nameCh}`} className="py-2">
            <FormerFacts row={row} />
          </li>
        ))}
      </ul>
      {!view.slice.length ? <Empty label="沒有符合嘅曾用名。" /> : null}
      <Pager page={view.page} pages={view.pages} onPage={setPage} />
    </>
  );
}

function FormerFacts({ row }: { row: FormerNameRow }) {
  return (
    <>
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12px]">
        <span className="tabnum font-mono-tx text-gold">{row.brand}</span>
        <span className="font-serif-tc font-bold text-ink">{row.nameCh}</span>
        {row.nameEn ? <span className="text-[11px] text-ink-3">{row.nameEn}</span> : null}
      </p>
      <p className="mt-1 text-[12px] text-ink-2">曾用名 {row.formerName ?? "—"}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
        {[row.importTypeCh, row.originCh, row.age != null ? `${row.age}歲` : "", row.foalingDate ? `出生 ${row.foalingDate}` : "", row.sire ? `父系 ${row.sire}` : "", row.dam ? `母系 ${row.dam}` : ""].filter(Boolean).join(" · ")}
      </p>
    </>
  );
}

function PpoList({ rows }: { rows: PpoRow[] }) {
  const seasons = ppoSeasons(rows);
  const [season, setSeason] = useState("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const picked = season === "all" || seasons.includes(season) ? season : "all";
  const filtered = filterRows(
    picked === "all" ? rows : rows.filter((row) => row.season === picked),
    query,
    (row) => `${row.horseNameCh} ${row.formerName ?? ""} ${row.brand} ${row.notes}`,
  );
  const view = pageOf(filtered, page);
  return (
    <>
      <Count n={filtered.length} />
      <div className="mt-2">
        <Seg
          value={picked}
          onChange={(value) => { setSeason(value); setPage(1); }}
          options={[{ value: "all", label: "全部馬季" }, ...seasons.map((item) => ({ value: item, label: item }))]}
        />
      </div>
      <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="馬名、曾用名或烙號" aria-label="篩選自購馬往績" className="tx-field mt-2 w-full" />
      <ul className="mt-2 divide-y divide-hairline">
        {view.slice.map((row) => (
          <li key={`${row.season}-${row.brand}`} className="py-2">
            <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-[12px]">
              <span className="tabnum font-mono-tx text-gold">{row.brand}</span>
              <span className="font-serif-tc font-bold text-ink">{row.horseNameCh}</span>
              <span className="text-[11px] text-ink-3">{row.season}</span>
              {row.seasonEnabled ? <Pill>本季</Pill> : null}
              {row.showPlay ? <Pill>官方標記可播放</Pill> : null}
            </p>
            <p className="mt-1 text-[12px] text-ink-2">曾用名 {row.formerName ?? "—"}</p>
            {row.notes ? <p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed text-ink-2">{row.notes}</p> : null}
          </li>
        ))}
      </ul>
      {!view.slice.length ? <Empty label="沒有符合嘅自購馬往績。" /> : null}
      <Pager page={view.page} pages={view.pages} onPage={setPage} />
    </>
  );
}

const MEETING_COPY = [
  { id: "ove-record", title: "賽日獸醫檢查", en: "Meeting veterinary list" },
  { id: "conghua-movement", title: "從化往來", en: "Conghua movement" },
  { id: "jt-combo", title: "騎練合作", en: "Jockey and trainer" },
  { id: "fwb-declared", title: "已申報特別獎金", en: "Declared bonus" },
  { id: "finish-photos", title: "終點照片", en: "Finish photos" },
  { id: "challenge-odds", title: "騎師王／練馬師王賠率", en: "Challenge odds" },
  { id: "racecard-profile", title: "排位馬匹資料", en: "Racecard profile" },
  { id: "racecard-files", title: "排位檔案及跑道圖", en: "Racecard files" },
] as const;

export function MeetingOfficialBoards({
  date,
  venue,
  raceNo,
  focus,
}: {
  date: string;
  venue: VenueCode;
  raceNo?: number | undefined;
  focus?: MeetingBoardId | undefined;
}) {
  const meeting = { date, venue };
  const ovePath = officialBoardPath("ove-record", meeting);
  const conghuaPath = officialBoardPath("conghua-movement", meeting);
  const jtPath = officialBoardPath("jt-combo", meeting);
  const fwbPath = officialBoardPath("fwb-declared", meeting);
  const photoPath = officialBoardPath("finish-photos", raceNo == null ? meeting : { ...meeting, raceNo });
  const oddsPath = officialBoardPath("challenge-odds", meeting);
  const ove = useBoard(ovePath);
  const conghua = useBoard(conghuaPath);
  const jt = useBoard(jtPath);
  const fwb = useBoard(fwbPath);
  const photos = useBoard(photoPath);
  const odds = useBoard(oddsPath);
  const cards = [
    <BoardCard key="ove-record" id="ove-record" title={MEETING_COPY[0].title} en={MEETING_COPY[0].en} path={ovePath} query={ove} read={readOveRows} render={(rows) => <OveList rows={rows as OveRow[]} />} />,
    <BoardCard key="conghua-movement" id="conghua-movement" title={MEETING_COPY[1].title} en={MEETING_COPY[1].en} path={conghuaPath} query={conghua} read={readConghuaRows} render={(rows) => <ConghuaList rows={rows as ConghuaRow[]} />} />,
    <BoardCard key="jt-combo" id="jt-combo" title={MEETING_COPY[2].title} en={MEETING_COPY[2].en} path={jtPath} query={jt} read={readJtRows} render={(rows) => <JtList rows={rows as JtRow[]} />} />,
    <BoardCard key="fwb-declared" id="fwb-declared" title={MEETING_COPY[3].title} en={MEETING_COPY[3].en} path={fwbPath} query={fwb} read={readFwbRows} render={(rows) => <FwbList rows={rows as FwbRow[]} />} />,
    <BoardCard key="finish-photos" id="finish-photos" title={raceNo ? `第${raceNo}場終點照片` : MEETING_COPY[4].title} en={MEETING_COPY[4].en} path={photoPath} query={photos} read={readFinishPhotos} render={(rows) => <PhotoGrid rows={rows as FinishPhotoRow[]} />} />,
    <BoardCard key="challenge-odds" id="challenge-odds" title={MEETING_COPY[5].title} en={MEETING_COPY[5].en} path={oddsPath} query={odds} read={readChallengeRows} render={(rows) => <ChallengeTable rows={rows as ChallengeRow[]} />} />,
    <RacecardProfileBoard key="racecard-profile" date={date} venue={venue} />,
    <RacecardFilesBoard key="racecard-files" date={date} venue={venue} />,
  ];
  const ordered = focus ? [...cards.filter((card) => card.key === focus), ...cards.filter((card) => card.key !== focus)] : cards;
  return (
    <>
      <nav aria-label="賽日官方資料" className="no-scrollbar mx-4 mt-3 flex gap-1 overflow-x-auto">
        {MEETING_COPY.map((item) => (
          <a key={item.id} href={`#official-${item.id}`} className="shrink-0 rounded-full border border-hairline bg-paper px-3 py-1.5 text-[12px] font-bold text-ink-2">{item.title}</a>
        ))}
      </nav>
      {raceNo ? <p className="mx-4 mt-2 text-[11px] text-ink-3">終點照片先顯示第{raceNo}場。其餘賽日資料係全日。</p> : null}
      {ordered}
    </>
  );
}

const DIRECTORY_COPY = [
  { id: "special-index" as const, title: "特別註解", en: "Special index" },
  { id: "ove-database" as const, title: "獸醫檢查名單", en: "Veterinary list" },
  { id: "ppo-performance" as const, title: "自購馬往績", en: "PPO notes" },
  { id: "horse-former-name" as const, title: "馬匹曾用名", en: "Former name" },
  { id: "stats-centre" as const, title: "賽日數據", en: "Stats centre" },
  { id: "horse-ratings" as const, title: "馬匹評分", en: "Horse ratings" },
  { id: "horse-news" as const, title: "馬匹消息", en: "Horse news" },
  { id: "import-policy" as const, title: "進口資格", en: "Import criteria" },
];

type ClassicDirectoryBoard = "special-index" | "ove-database" | "ppo-performance" | "horse-former-name";

function isClassicDirectory(board: DirectoryBoardId): board is ClassicDirectoryBoard {
  return board in readers;
}

export function DirectoryOfficialBoards({
  board,
  brand,
  onBoard,
}: {
  board: DirectoryBoardId;
  brand?: string | undefined;
  onBoard: (board: DirectoryBoardId) => void;
}) {
  const selected = DIRECTORY_COPY.some((item) => item.id === board) ? board : "special-index";
  const classic = isClassicDirectory(selected) ? selected : null;
  const brandQuery = selected === "horse-former-name" ? brand : undefined;
  const path = classic ? officialBoardPath(classic, brandQuery ? { brand: brandQuery } : {}) : null;
  const query = useBoard(path);
  const copy = DIRECTORY_COPY.find((item) => item.id === selected) ?? DIRECTORY_COPY[0]!;
  const invalidBrand = selected === "horse-former-name" && !!brand && !asLocalBrand(brand);
  return (
    <>
      <div className="mx-4 mt-3">
        <Seg value={selected} onChange={onBoard} options={DIRECTORY_COPY.map((item) => ({ value: item.id, label: item.title }))} />
      </div>
      {selected === "stats-centre" ? <StatsCentreBoard /> : selected === "horse-ratings" ? <HorseRatingsBoard /> : selected === "horse-news" ? <HorseNewsBoard /> : selected === "import-policy" ? <ImportPolicyBoard /> : !classic ? null : invalidBrand ? (
        <Card title={copy.title} en={copy.en}>
          <p className="text-[12px] leading-relaxed text-ink-2">烙號請用單字母加數字，例如 J313。呢個烙號接口唔接受。</p>
          {note()}
        </Card>
      ) : (
        <BoardCard
          id={selected}
          title={copy.title}
          en={copy.en}
          path={path}
          query={query}
          read={readers[classic]}
          render={(rows, envelope) => directoryBody(classic, rows, envelope)}
        />
      )}
    </>
  );
}

const readers: Record<ClassicDirectoryBoard, (envelope: OfficialEnvelope) => unknown[]> = {
  "special-index": readSpecialIndex,
  "ove-database": readOveRows,
  "ppo-performance": readPpoRows,
  "horse-former-name": readFormerNames,
};

function directoryBody(board: ClassicDirectoryBoard, rows: unknown, envelope: OfficialEnvelope): ReactNode {
  if (board === "special-index") return <SpecialList rows={rows as SpecialIndexRow[]} />;
  if (board === "ove-database") {
    return (
      <>
        {envelope.asOf ? <p className="mb-2 text-[11px] text-ink-3">名單截至 {envelope.asOf}</p> : null}
        <OveList rows={rows as OveRow[]} />
      </>
    );
  }
  if (board === "ppo-performance") return <PpoList rows={rows as PpoRow[]} />;
  return <FormerList rows={rows as FormerNameRow[]} />;
}

export function FormerNameCard({ brand }: { brand: string }) {
  const local = asLocalBrand(brand);
  const path = local ? officialBoardPath("horse-former-name", { brand: local }) : null;
  const query = useBoard(path);
  if (!path) return null;
  const row = query.data ? readFormerNames(query.data)[0] : undefined;
  return (
    <Card title="馬匹曾用名" en="Former name" action={<Pill>官方顯示</Pill>}>
      {query.isPending ? <Loading label="讀取曾用名…" /> : query.isError ? <ErrorNote error={query.error} /> : row ? <FormerFacts row={row} /> : <Empty label={emptyBoardLabel(query.data?.available ?? false)} />}
      <p className="mt-2 text-[12px]">
        <Link to="/official-boards" search={{ scope: "directory", board: "horse-former-name" }} className="font-bold text-gold underline underline-offset-2">瀏覽曾用名名冊 →</Link>
      </p>
      {note()}
    </Card>
  );
}

