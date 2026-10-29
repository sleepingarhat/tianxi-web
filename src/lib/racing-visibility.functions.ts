import { cached, CACHE_TTL } from "./computed-cache.server";
import { createServerFn } from "@tanstack/react-start";
import { completeAuditRace, coverageRows, parseResultsCsv, type AuditMeeting, type CoverageRow } from "./racing-visibility";
import { TX_BASE } from "./tx-api";
import { sameFourPicks } from "./audit-safety";

export const getCoverageAudit = createServerFn({ method: "GET" })
  .inputValidator((input: { days?: number }) => ({ days: Math.min(365, Math.max(30, Math.round(Number(input.days) || 180))) }))
  .handler(async ({ data }) => {
    const [{ readStoredCoverageAudit }, { viewerTier }, { projectCoverageAudit }] = await Promise.all([
      import('./coverage-snapshot.server'), import('./picks-entitlement.server'), import('./hit-rate-projection')]);
    // 快取保存完整結果；分級喺讀快取之後先做。
    const [audit, tier] = await Promise.all([readStoredCoverageAudit(data.days), viewerTier()]);
    return projectCoverageAudit(audit, tier);
  });
/** 引擎價值對照：由當前凍結版本首次使用日起，只讀凍結四揀與收市賠率。 */
export const getValueComparison = createServerFn({ method: "GET" })
  .inputValidator((input: { from: string; version: string }) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^[\w.-]{1,100}$/.test(input.version)) throw new Error("版本或起計日期無效");
    return { from: input.from, version: input.version };
  })
  .handler(async ({ data }) => cached(`value-cmp:original-v5:${data.version}:${data.from}`, CACHE_TTL, async () => {
    const { valueRace, summarizeValue } = await import("./racing-visibility");
    const { workerFetch } = await import("./site-reader.server");
    const readJson = async (url: string) => {
      const r = await workerFetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error("賽果資料暫時未能讀取");
      return r.json();
    };
    const days = Math.min(365, Math.max(30, Math.ceil((Date.now() - Date.parse(data.from)) / 86_400_000) + 2));
    const roll = await readJson(`${TX_BASE}/api/analyze/hit-rate-rollup?days=${days}`) as { perMeeting?: { date: string }[] };
    const dates = [...new Set((roll.perMeeting ?? []).map(m => m.date))].filter(d => d >= data.from).sort();
    const { publicRacingQuery } = await import('./public-racing-evidence.server');
    const evidence = await publicRacingQuery<{ date: string; race_number: number; horse_numbers: string }>(
      "SELECT date,race_number,GROUP_CONCAT(horse_number) AS horse_numbers FROM prediction_log WHERE engine='v12' AND variant='baseline' AND predicted_rank BETWEEN 1 AND 4 AND date>=? GROUP BY date,race_number HAVING COUNT(*)=4 AND COUNT(DISTINCT horse_number)=4 AND MIN(lgb_model_version)=? AND MAX(lgb_model_version)=? AND COUNT(lgb_model_version)=4",
      [data.from, data.version, data.version]);
    const cohort = new Map(evidence.map(r => [`${r.date}:${r.race_number}`, r.horse_numbers.split(",").map(Number)]));
    const perDay: { date: string; rows: ReturnType<typeof valueRace>[] }[] = [];
    const failed: string[] = [];
    for (let i = 0; i < dates.length; i += 4) {
      await Promise.all(dates.slice(i, i + 4).map(async date => {
        try {
          const [j, csv] = await Promise.all([
            readJson(`${TX_BASE}/api/analyze/hit-rate?date=${date}`) as Promise<Partial<AuditMeeting>>,
            fetch(`https://raw.githubusercontent.com/sleepingarhat/tianxi-racing/main/data/${date.slice(0, 4)}/results_${date}.csv`, { signal: AbortSignal.timeout(15_000) }).then(r => r.ok ? r.text() : "").catch(() => ""),
          ]);
          if (!csv) throw new Error("缺少收市賽果檔");
          const res = parseResultsCsv(csv);
          if (!res.size) throw new Error("收市賽果格式不完整");
          const eligible = (j.races ?? []).filter(completeAuditRace).filter(r => sameFourPicks(cohort.get(`${date}:${r.raceNumber}`) ?? [], (r.predictedTop4 ?? []).slice(0, 4).map(p => p.horseNumber)));
          if (eligible.length) perDay.push({ date, rows: eligible.map(r => valueRace(r, res.get(r.raceNumber) ?? [])) });
        } catch { failed.push(date); }
      }));
    }
    if (failed.length) throw new Error(`有${failed.length}個賽日資料未能完整讀取；暫不更新版本對照`);
    perDay.sort((a, b) => a.date.localeCompare(b.date));
    const all: NonNullable<ReturnType<typeof valueRace>>[] = [];
    const trend = perDay.map(d => { all.push(...d.rows.filter((r): r is NonNullable<typeof r> => !!r)); const s = summarizeValue(all); return { date: d.date, engineOdds: s.engineOdds, marketOdds: s.marketOdds, engineHits: s.engineHits, marketHits: s.marketHits }; });
    return { from: data.from, to: perDay.at(-1)?.date ?? null, meetings: perDay.length, summary: summarizeValue(all), trend };
  }));
