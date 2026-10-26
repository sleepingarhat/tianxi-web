// 賽馬後端健康 + 回測（唯讀）。只讀倉庫／Worker，唔改任何凍結數值。
import { createServerFn } from "@tanstack/react-start";
import { requireTier } from "./tier.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GH = "https://api.github.com/repos/sleepingarhat/tianxi-racing";
const RAW = "https://raw.githubusercontent.com/sleepingarhat/tianxi-racing/main";
const WORKER = "https://tianxi-backend.tianxi-entertainment.workers.dev";

function gh(path: string) {
  const token = process.env["GITHUB_TOKEN"];
  return fetch(`${GH}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "tianxi-web",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
}

export type WorkflowState = {
  label: string;
  file: string;
  status: string;
  conclusion: string | null;
  startedAt: string | null;
  ageHours: number | null;
  state: "ok" | "warn" | "fail" | "unknown";
};

export const getRacingHealth = createServerFn({ method: "GET" }).handler(async () => {
  const { setResponseHeader } = await import('@tanstack/react-start/server');
  setResponseHeader('Cache-Control', 'private, no-store');
  const { readRacingHealth } = await import('./racing-health.server');
  const { publicRacingHealth } = await import('./racing-health-projection');
  return publicRacingHealth(await readRacingHealth());
});

export const getAdminRacingHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: role, error } = await context.supabase.from('user_roles').select('role')
      .eq('user_id', context.userId).eq('role', 'admin').maybeSingle();
    if (error || !role) throw new Response('只限管理員', { status: 403 });
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'private, no-store');
    const { readRacingHealth } = await import('./racing-health.server');
    return readRacingHealth();
  });

/* ---------------- 回測：引擎 vs 隨機 vs 市場 ---------------- */

function comb(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

function splitCsv(line: string) {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

type Runner = { no: number; place: number | null; odds: number | null };

async function loadResults(date: string): Promise<Map<number, Runner[]>> {
  const res = await fetch(`${RAW}/data/${date.slice(0, 4)}/results_${date}.csv`, { signal: AbortSignal.timeout(10_000) });
  const map = new Map<number, Runner[]>();
  if (!res.ok) return map;
  const lines = (await res.text()).replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  const head = splitCsv(lines[0] ?? "");
  const iR = head.indexOf("race_no"), iP = head.indexOf("place"), iN = head.indexOf("horse_no"), iO = head.indexOf("win_odds");
  for (const l of lines.slice(1)) {
    const c = splitCsv(l);
    const race = Number(c[iR]);
    const no = Number(c[iN]);
    if (!race || !no) continue;
    const p = parseInt(c[iP] ?? "", 10);
    const o = Number(c[iO]);
    const arr = map.get(race) ?? [];
    arr.push({ no, place: Number.isFinite(p) ? p : null, odds: Number.isFinite(o) && o > 0 ? o : null });
    map.set(race, arr);
  }
  return map;
}

type Metric = { key: string; label: string; engine: number; random: number; market: number; n: number };
const BOX_COST: Record<string, number> = { FF: 10, TRIO: 40, TIERCE: 240, QUARTET: 240 };
const BOX_LABEL: Record<string, string> = { TRIO: "單T 4 揀複式", FF: "四連環 4 揀", TIERCE: "三重彩 4 揀複式", QUARTET: "四重彩 4 揀複式" };

export const getRacingBacktest = createServerFn({ method: "GET" })
  .middleware([requireTier("registered")])
  .inputValidator((d: { days?: number }) => ({ days: Math.min(365, Math.max(30, Number(d?.days) || 180)) }))
  .handler(async ({ data }) => {
    const roll = (await (await (await import("./site-reader.server")).workerFetch(`${WORKER}/api/analyze/hit-rate-rollup?days=${data.days}`, { signal: AbortSignal.timeout(15_000) })).json()) as {
      perMeeting?: { date: string; venue: string }[];
      from?: string;
      to?: string;
    };
    const meetings = (roll.perMeeting ?? []).slice(0, 60);

    const acc = {
      top1: [0, 0, 0], top3any: [0, 0, 0], top4: [0, 0, 0], trio4: [0, 0, 0], ff: [0, 0, 0],
    } as Record<string, [number, number, number]>;
    let n = 0;
    let fieldSum = 0;
    const roi: Record<string, { cost: number; ret: number; hits: number }> = {};
    for (const k of Object.keys(BOX_COST)) roi[k] = { cost: 0, ret: 0, hits: 0 };
    const perMeeting: { date: string; venue: string; races: number; engineTop4: number; randomTop4: number; marketTop4: number }[] = [];

    const loaded = await Promise.all(
      meetings.map(async (m) => {
        try {
          const [hr, results] = await Promise.all([
            import("./site-reader.server").then(({ workerFetch }) => workerFetch(`${WORKER}/api/analyze/hit-rate?date=${m.date}`, { signal: AbortSignal.timeout(15_000) })).then((r) => (r.ok ? r.json() : null)),
            loadResults(m.date),
          ]);
          return { m, hr, results };
        } catch {
          return { m, hr: null, results: new Map<number, Runner[]>() };
        }
      }),
    );

    for (const { m, hr, results } of loaded) {
      const races = ((hr as { races?: unknown[] } | null)?.races ?? []) as {
        raceNumber: number;
        predictedTop4?: { horseNumber: number }[];
        boxPayouts?: { pool: string; dividend: number }[];
      }[];
      let mN = 0, mE = 0, mR = 0, mM = 0;
      for (const r of races) {
        const runners = (results.get(r.raceNumber) ?? []).filter((x) => x.place != null);
        const picks = (r.predictedTop4 ?? []).map((p) => p.horseNumber).slice(0, 4);
        const N = runners.length;
        if (N < 5 || picks.length < 4) continue;
        const byPlace = runners.slice().sort((a, b) => (a.place! - b.place!));
        const top3 = new Set(byPlace.slice(0, 3).map((x) => x.no));
        const top4 = new Set(byPlace.slice(0, 4).map((x) => x.no));
        const winner = byPlace[0]!.no;
        const mk = runners.filter((x) => x.odds != null).sort((a, b) => a.odds! - b.odds!).map((x) => x.no).slice(0, 4);
        if (mk.length < 4) continue;
        const score = (p: number[]) => ({
          top1: p[0] === winner ? 1 : 0,
          top3any: p.slice(0, 3).some((x) => top3.has(x)) ? 1 : 0,
          top4: p.filter((x) => top4.has(x)).length,
          trio4: [...top3].every((x) => p.includes(x)) ? 1 : 0,
          ff: [...top4].every((x) => p.includes(x)) ? 1 : 0,
        });
        const e = score(picks), k = score(mk);
        const rnd = {
          top1: 1 / N,
          top3any: 1 - comb(N - 3, 3) / comb(N, 3),
          top4: 16 / N,
          trio4: 4 / comb(N, 3),
          ff: 1 / comb(N, 4),
        };
        for (const key of Object.keys(acc)) {
          acc[key]![0] += e[key as keyof typeof e];
          acc[key]![1] += rnd[key as keyof typeof rnd];
          acc[key]![2] += k[key as keyof typeof k];
        }
        n++;
        fieldSum += N;
        mN++; mE += e.top4; mR += rnd.top4; mM += k.top4;
        for (const pool of Object.keys(BOX_COST)) {
          roi[pool]!.cost += BOX_COST[pool]!;
          const hit = (r.boxPayouts ?? []).find((b) => b.pool === pool);
          if (hit) {
            roi[pool]!.ret += Number(hit.dividend) || 0;
            roi[pool]!.hits++;
          }
        }
      }
      if (mN) perMeeting.push({ date: m.date, venue: m.venue, races: mN, engineTop4: mE / mN, randomTop4: mR / mN, marketTop4: mM / mN });
    }

    const LABELS: Record<string, string> = {
      top4: "四揀平均中匹數",
      top3any: "三甲任中（首 3 揀）",
      top1: "頭馬（首選）",
      trio4: "單T 中（4 揀包首 3）",
      ff: "四連環中（4 揀＝首 4）",
    };
    const metrics: Metric[] = ["top4", "top3any", "top1", "trio4", "ff"].map((key) => ({
      key,
      label: LABELS[key]!,
      engine: n ? acc[key]![0] / n : 0,
      random: n ? acc[key]![1] / n : 0,
      market: n ? acc[key]![2] / n : 0,
      n,
    }));

    // 引擎四揀中匹數 vs 隨機：每場方差近似用超幾何分佈，計 z 值
    let varSum = 0;
    // 用平均場數近似
    const Nbar = n ? fieldSum / n : 12;
    const hv = 4 * (4 / Nbar) * (1 - 4 / Nbar) * ((Nbar - 4) / (Nbar - 1));
    varSum = hv * n;
    const z = n && varSum > 0 ? (acc["top4"]![0] - acc["top4"]![1]) / Math.sqrt(varSum) : 0;

    const roiRows = Object.entries(roi).map(([pool, v]) => ({
      pool,
      label: BOX_LABEL[pool]!,
      cost: v.cost,
      ret: v.ret,
      hits: v.hits,
      net: v.ret - v.cost,
      roiPct: v.cost ? ((v.ret - v.cost) / v.cost) * 100 : 0,
    }));

    return {
      from: roll.from ?? null,
      to: roll.to ?? null,
      meetings: perMeeting.length,
      races: n,
      avgField: Nbar,
      metrics,
      z,
      roi: roiRows,
      perMeeting: perMeeting.sort((a, b) => (a.date < b.date ? -1 : 1)),
    };
  });

/* ---------------- 訓練數據規模 ---------------- */

export const getRacingTrainingData = createServerFn({ method: "GET" }).middleware([requireTier("registered")]).handler(async () => {
  const res = await gh(`/git/trees/main?recursive=1`);
  if (!res.ok) return { years: [], totals: { meetings: 0, horses: 0, files: 0 } };
  const j = (await res.json()) as { tree: { path: string; type: string; size?: number }[] };
  const years = new Map<string, { meetings: number; dividends: number; sectional: number; bytes: number }>();
  let horses = 0;
  for (const t of j.tree) {
    if (t.type !== "blob") continue;
    const m = t.path.match(/^data\/(\d{4})\/(results|dividends|sectional_times)_\d{4}-\d{2}-\d{2}\.csv$/);
    if (m) {
      const y = years.get(m[1]!) ?? { meetings: 0, dividends: 0, sectional: 0, bytes: 0 };
      if (m[2] === "results") { y.meetings++; y.bytes += t.size ?? 0; }
      if (m[2] === "dividends") y.dividends++;
      if (m[2] === "sectional_times") y.sectional++;
      years.set(m[1]!, y);
    }
    if (/^horses\/.+\.(csv|json)$/.test(t.path)) horses++;
  }
  const list = [...years.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([year, v]) => ({ year, ...v }));
  return {
    years: list,
    totals: { meetings: list.reduce((s, y) => s + y.meetings, 0), horses, files: j.tree.length },
  };
});
