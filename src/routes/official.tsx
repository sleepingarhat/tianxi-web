import { createFileRoute } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { OfficialLibrary, type OfficialSearch } from "@/components/tx/OfficialLibrary";
import { Disclaimer, PageHead } from "@/components/tx/ui";
import { asDate, asVenue, isMeetingBoard, type MeetingBoardId } from "@/lib/official-boards";
import { isOfficialSurface } from "@/lib/official-library";

const MEETING_TEXT = new Set<MeetingBoardId>(["ove-record", "conghua-movement", "jt-combo", "fwb-declared", "challenge-odds"]);

function boundedBrand(value: unknown): string | undefined {
  if (typeof value !== "string" || !/^[A-Za-z0-9]{2,8}$/.test(value)) return undefined;
  return value.toUpperCase();
}

export const Route = createFileRoute("/official")({
  validateSearch: (search: Record<string, unknown>): OfficialSearch => {
    const surface = typeof search["surface"] === "string" && isOfficialSurface(search["surface"]) ? search["surface"] : undefined;
    const board = typeof search["board"] === "string" && isMeetingBoard(search["board"]) && MEETING_TEXT.has(search["board"]) ? search["board"] : undefined;
    const raceNo = typeof search["raceNo"] === "number" ? search["raceNo"] : typeof search["raceNo"] === "string" && /^\d{1,2}$/.test(search["raceNo"]) ? Number(search["raceNo"]) : undefined;
    return {
      surface,
      date: asDate(search["date"]) ?? undefined,
      venue: asVenue(search["venue"]) ?? undefined,
      raceNo: raceNo != null && raceNo >= 1 && raceNo <= 15 ? raceNo : undefined,
      board: surface === "meeting" ? board : undefined,
      brand: surface === "former" ? boundedBrand(search["brand"]) : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "官方資料庫 · 天喜 TIANXI" },
      { name: "description", content: "已收錄嘅馬會官方資料：終點照片、跑道圖、排位馬匹、獸醫、從化、騎練、特別獎金、評分榜、馬匹消息、曾用名、進口資格同賽日數據海報。空白就係未收錄。" },
      { property: "og:title", content: "官方資料庫 · 天喜 TIANXI" },
      { property: "og:description", content: "只顯示已經收錄嘅馬會官方資料。空白就係未收錄，唔會補數。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: OfficialPage,
});

function OfficialPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  return (
    <AppShell page="" columns={false} ticker="官方資料庫 · 已收錄先顯示">
      <PageHead
        en="Official records"
        title="官方資料庫"
        desc="只顯示 Worker 已經公開嘅馬會資料。空白或「未收錄」就係未收集到，唔會補數、唔會插值。呢啲唔係賽果名次，亦唔會用作預測。"
      />
      <OfficialLibrary search={search} onSearch={(next) => void navigate({ search: next, replace: true })} />
      <Disclaimer />
    </AppShell>
  );
}
