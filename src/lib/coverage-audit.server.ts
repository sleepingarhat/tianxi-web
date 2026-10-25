import { cached, CACHE_TTL } from "./computed-cache.server";
import { completeAuditRace, coverageRows, parseResultsCsv, type AuditMeeting, type CoverageRow } from "./racing-visibility";
import { TX_BASE } from "./tx-api";
import { workerFetch } from "./site-reader.server";
export async function readCoverageAudit(days: number, force = false) {
  const data = { days };
  return cached(`coverage:original-v5:${days}`, force ? 0 : CACHE_TTL, async () => {
    const readJson = async (url: string) => {
      const response = await workerFetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error("賽果資料暫時未能讀取");
      return response.json();
    };
    const roll = await readJson(`${TX_BASE}/api/analyze/hit-rate-rollup?days=${data.days}`) as { perMeeting?: { date: string; venue: string }[]; from?: string; to?: string };
    const dates = [...new Map((roll.perMeeting ?? []).map(m => [m.date, m])).values()];
    const meetings: AuditMeeting[] = [], rows: CoverageRow[] = [], failed: string[] = [], missingOdds: string[] = [];
    let excluded = 0;
    // Bounded concurrency keeps the existing data service usable for other pages.
    for (let offset = 0; offset < dates.length; offset += 3) {
      await Promise.all(dates.slice(offset, offset + 3).map(async m => {
        try {
          const [payload, csv] = await Promise.all([
            readJson(`${TX_BASE}/api/analyze/hit-rate?date=${m.date}`),
            fetch(`https://raw.githubusercontent.com/sleepingarhat/tianxi-racing/main/data/${m.date.slice(0, 4)}/results_${m.date}.csv`, { signal: AbortSignal.timeout(15_000) })
              .then(r => r.ok ? r.text() : "").catch(() => ""),
          ]);
          const j = payload as Partial<AuditMeeting>;
          const meeting: AuditMeeting = { date: m.date, venue: j.venue ?? m.venue, races: (j.races ?? []).filter(completeAuditRace) };
          excluded += (j.races ?? []).length - meeting.races.length;
          if (!csv) missingOdds.push(m.date);
          if (meeting.races.length) { meetings.push(meeting); rows.push(...coverageRows(meeting, parseResultsCsv(csv))); }
        } catch { failed.push(m.date); }
      }));
    }
    if (failed.length || missingOdds.length) throw new Error("分層對帳未能完整讀取，保留上次資料並暫停更新");
    meetings.sort((a, b) => b.date.localeCompare(a.date));
    rows.sort((a, b) => b.date.localeCompare(a.date) || a.raceNo - b.raceNo);
    return { from: roll.from ?? null, to: meetings[0]?.date ?? null, checkedAt: new Date().toISOString(), meetings, rows, failed, missingOdds, excluded };
  });
}
