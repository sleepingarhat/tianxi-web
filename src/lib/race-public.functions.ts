import { createServerFn } from "@tanstack/react-start";
import { canonicalRaceId, TX_BASE, type Meeting } from "./tx-api";
import type { PublicRace } from "./race-seo";

export const getPublicRacePage = createServerFn({ method: "GET" })
  .inputValidator((input: { id?: string }) => ({ id: canonicalRaceId(input.id) }))
  .handler(async ({ data }): Promise<{ race: PublicRace | null; next: Meeting | null }> => {
    const read = async (path: string, ms = 15_000) => {
      const response = await fetch(`${TX_BASE}${path}`, { credentials: "omit", signal: AbortSignal.timeout(ms) });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error("賽事資料暫時未能讀取，請稍後再試。");
      return response.json();
    };
    if (!data.id) return { race: null, next: await read("/api/meetings/next") as Meeting | null };
    const parts = data.id.split("_");
    const date = parts[1] || "";
    // 單場端點偶爾因資料庫繁忙要近30秒；平行讀排位表，單場逾時唔再令整頁 500。
    const [direct, meeting] = await Promise.all([
      read(`/api/races/${encodeURIComponent(data.id)}`, 6_000).catch(() => null) as Promise<PublicRace | null>,
      read(`/api/meetings/${date}`, 8_000).catch(() => null) as Promise<Meeting | null>,
    ]);
    if (direct && (direct.horses?.length || direct.entries?.length)) return { race: direct, next: null };
    if (!meeting || meeting.venue !== parts[2]) return { race: direct, next: null };
    const summary = meeting.races?.find(r => r.id === data.id);
    return { race: summary ? { ...summary, meetingDate: date, venue: meeting.venue } : direct, next: null };
  });