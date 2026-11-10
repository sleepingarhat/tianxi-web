import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { DirectoryOfficialBoards, MeetingOfficialBoards } from "@/components/tx/OfficialBoards";
import { Card, Disclaimer, PageHead, Seg } from "@/components/tx/ui";
import {
  asDate,
  asVenue,
  isDirectoryBoard,
  isMeetingBoard,
  officialScopeOf,
  type DirectoryBoardId,
  type MeetingBoardId,
  type OfficialScope,
  type VenueCode,
} from "@/lib/official-boards";

type Search = {
  scope?: OfficialScope | undefined;
  date?: string | undefined;
  venue?: VenueCode | undefined;
  board?: MeetingBoardId | DirectoryBoardId | undefined;
  raceNo?: number | undefined;
  brand?: string | undefined;
};

function boundedBrand(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9]{2,8}$/.test(value)) return undefined;
  return value.toUpperCase();
}

export const Route = createFileRoute("/official-boards")({
  validateSearch: (search: Record<string, unknown>): Search => {
    const board = typeof search["board"] === "string" && (isMeetingBoard(search["board"]) || isDirectoryBoard(search["board"])) ? search["board"] : undefined;
    const raceNo = typeof search["raceNo"] === "number" ? search["raceNo"] : typeof search["raceNo"] === "string" && /^\d{1,2}$/.test(search["raceNo"]) ? Number(search["raceNo"]) : undefined;
    return {
      scope: search["scope"] === "meeting" || search["scope"] === "directory" ? search["scope"] : undefined,
      date: asDate(search["date"]) ?? undefined,
      venue: asVenue(search["venue"]) ?? undefined,
      board,
      raceNo: raceNo != null && raceNo >= 1 && raceNo <= 15 ? raceNo : undefined,
      brand: boundedBrand(search["brand"]),
    };
  },
  head: () => ({
    meta: [
      { title: "官方資料 · 天喜 TIANXI" },
      { name: "description", content: "已收錄嘅馬會官方顯示：賽日獸醫檢查、從化往來、騎練合作、特別獎金、終點照片、騎練王賠率、排位馬匹資料同排位檔案，以及獸醫名單、自購馬往績、曾用名、特別註解、賽日數據、馬匹評分、馬匹消息同進口資格。" },
      { property: "og:title", content: "官方資料 · 天喜 TIANXI" },
      { property: "og:description", content: "馬會已收錄嘅官方顯示。唔係賽果名次，亦唔會用作預測。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfficialBoardsPage,
});

function OfficialBoardsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const scope = officialScopeOf(search);
  const [draftDate, setDraftDate] = useState(search.date ?? "");
  const [draftVenue, setDraftVenue] = useState<VenueCode>(search.venue ?? "ST");
  const directoryBoard: DirectoryBoardId = search.board && isDirectoryBoard(search.board) ? search.board : "special-index";
  const meetingFocus: MeetingBoardId | undefined = search.board && isMeetingBoard(search.board) ? search.board : undefined;

  useEffect(() => {
    setDraftDate(search.date ?? "");
    if (search.venue) setDraftVenue(search.venue);
  }, [search.date, search.venue]);

  function openMeeting(date: string, venue: VenueCode) {
    void navigate({ search: { scope: "meeting", date, venue, board: meetingFocus }, replace: true });
  }

  return (
    <AppShell page="" columns={false} ticker="官方資料 · 已收錄嘅馬會顯示">
      <PageHead
        en="Official records"
        title="官方資料"
        desc="只顯示已經收錄嘅馬會官方資料。空白就係未收錄，唔會補數。呢啲係官方顯示，唔係賽果名次，亦唔會用作預測。"
      />
      <div className="mx-4 mt-3">
        <Seg
          value={scope}
          onChange={(next) => {
            const board = next === "directory"
              ? (search.board && isDirectoryBoard(search.board) ? search.board : "special-index")
              : (search.board && isMeetingBoard(search.board) ? search.board : undefined);
            void navigate({ search: { ...search, scope: next, board }, replace: true });
          }}
          options={[{ value: "meeting", label: "賽日" }, { value: "directory", label: "名冊" }]}
        />
      </div>
      {scope === "meeting" ? (
        <>
          <Card title="賽事日" en="Meeting">
            <form
              className="flex flex-col gap-2 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                const date = asDate(draftDate);
                if (date) openMeeting(date, draftVenue);
              }}
            >
              <label className="block min-w-0 flex-1 text-[11px] text-ink-3">
                日期
                <input type="date" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className="tx-field mt-1 w-full" />
              </label>
              <div className="min-w-0">
                <p className="text-[11px] text-ink-3">馬場</p>
                <div className="mt-1">
                  <Seg
                    value={draftVenue}
                    onChange={setDraftVenue}
                    options={[{ value: "ST", label: "沙田" }, { value: "HV", label: "跑馬地" }]}
                  />
                </div>
              </div>
              <button type="submit" className="h-8 rounded-full border border-hairline bg-paper px-3 text-[12px] font-bold text-ink">顯示呢個賽日</button>
            </form>
          </Card>
          {search.date && search.venue ? (
            <MeetingOfficialBoards date={search.date} venue={search.venue} raceNo={search.raceNo} focus={meetingFocus} />
          ) : (
            <Card title="未揀賽事日" en="Choose a meeting">
              <p className="text-[12px] leading-relaxed text-ink-2">由賽程或賽日頁入嚟，或者上面揀日期同馬場。未揀之前唔會查賽日資料。</p>
            </Card>
          )}
        </>
      ) : (
        <DirectoryOfficialBoards
          board={directoryBoard}
          brand={search.brand}
          onBoard={(board) => void navigate({ search: { ...search, scope: "directory", board }, replace: true })}
        />
      )}
      <Disclaimer />
    </AppShell>
  );
}
