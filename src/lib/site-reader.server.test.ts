import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), tier: vi.fn(), cached: vi.fn(), query: vi.fn(), pro: vi.fn(), validate: vi.fn(), rpc: vi.fn(), prelock: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: (v: (i: unknown) => unknown) => { (builder as any).v = v; return builder; }, handler: (h: (a: { data: unknown; context?: unknown }) => unknown) => (input: { data: unknown; context?: unknown }) => h({ data: (builder as any).v(input.data), context: input.context }) };
  return builder;
} }));
vi.mock("./picks-entitlement.server", () => ({ viewerTier: () => mocks.tier() }));
vi.mock("./computed-cache.server", () => ({ CACHE_TTL: 1, cached: (_k: string, _t: number, fn: () => unknown) => mocks.cached(fn) }));
vi.mock('@tanstack/react-start/server', () => ({ setResponseHeader: vi.fn() }));
vi.mock('./public-racing-evidence.server', () => ({ publicRacingQuery: (sql: string) => mocks.query(sql) }));
vi.mock('./coverage-snapshot.server', () => ({ readStoredCoverageAudit: () => mocks.cached(() => { throw new Error('missing snapshot'); }) }));
vi.mock('./evidence-viewer.server', () => ({ evidenceViewerIsPro: () => mocks.pro() }));
vi.mock('./frozen-racing', () => ({ frozenColumns: ['date'], frozenEvidenceStatus: () => 'available', validateFrozenSnapshot: () => mocks.validate() }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { rpc: (...args: unknown[]) => mocks.rpc(...args) } }));
vi.mock('./prelock-workflow', () => ({ advancePrelock: (...args: unknown[]) => mocks.prelock(...args) }));
vi.mock('./telegramAlert.server', () => ({ sendTelegramAlert: vi.fn() }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));

import { SITE_READER_HEADER, siteReaderHeaders, workerFetch } from "./site-reader.server";
import { TX_BASE } from "./tx-api";
import { getMeetingHitRate } from "./hit-rate.functions";
import { getCoverageAudit } from "./racing-visibility.functions";
import { readCoverageAudit } from "./coverage-audit.server";
import { getLockedEvidence } from './racing-evidence.functions';
import { recomputeIfStaleBeforeLock } from './hkjc-changes.server';
import { fetchTodayPicksUpstream, getOraclePicks } from './picks.functions';

let token = "";
beforeEach(() => {
  vi.resetAllMocks();
  token = "test-" + crypto.randomUUID();
  vi.stubEnv("SITE_READER_TOKEN", token);
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.cached.mockImplementation((fn: () => unknown) => fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const headerOf = (call: unknown[]) => new Headers((call[1] as RequestInit | undefined)?.headers).get(SITE_READER_HEADER);
const race = (n: number) => ({ raceNumber: n, distance: 1200, scoreSource: "lgb", ensembleAlpha: 0.5, top4IntersectCount: 3, quinellaHit: true, boxPayouts: { TRIO: 100 },
  predictedTop4: [1, 2, 3, 4].map(h => ({ horseNumber: h, rank: h })), predictedFifth: { horseNumber: 5 },
  actualTop4: [1, 2, 3, 6].map((h, i) => ({ horseNumber: h, position: i + 1, hit: h < 5 })) });
const hitRateBody = { venue: "ST", summary: { avg: 3 }, races: [race(1), race(2)] };

describe("網站唯讀憑證", () => {
  it("有設定先加 header，冇設定回空物件", () => {
    expect(siteReaderHeaders()).toEqual({ [SITE_READER_HEADER]: token });
    vi.stubEnv("SITE_READER_TOKEN", "  ");
    expect(siteReaderHeaders()).toEqual({});
  });
  it("只向 Worker 網址加 header，GitHub 唔加，並保留原有 header 同 signal", async () => {
    mocks.fetch.mockResolvedValue({ ok: true });
    const signal = AbortSignal.timeout(5000);
    await workerFetch(`${TX_BASE}/api/analyze/hit-rate?date=2026-10-25`, { signal, headers: { Accept: "application/json" } });
    await workerFetch("https://raw.githubusercontent.com/sleepingarhat/tianxi-racing/main/data/x.csv");
    await workerFetch(`${TX_BASE}.evil.example/api`);
    expect(headerOf(mocks.fetch.mock.calls[0]!)).toBe(token);
    expect(new Headers(mocks.fetch.mock.calls[0]![1].headers).get("accept")).toBe("application/json");
    expect(mocks.fetch.mock.calls[0]![1].signal).toBe(signal);
    expect(headerOf(mocks.fetch.mock.calls[1]!)).toBeNull();
    expect(headerOf(mocks.fetch.mock.calls[2]!)).toBeNull();
  });
  it("讀取失敗嘅錯誤訊息唔含憑證", async () => {
    mocks.fetch.mockResolvedValue({ ok: false, status: 503 });
    mocks.tier.mockResolvedValue("pro");
    const err = await (getMeetingHitRate as any)({ data: { date: "2026-10-25" } }).catch((e: Error) => e);
    expect(String(err?.message)).not.toContain(token);
  });
});

describe("單日對帳分級", () => {
  beforeEach(() => mocks.fetch.mockResolvedValue({ ok: true, json: async () => structuredClone(hitRateBody) }));
  it("請求帶憑證；訪客第2場起冇預測、派彩同命中旗標", async () => {
    mocks.tier.mockResolvedValue("guest");
    const out = await (getMeetingHitRate as any)({ data: { date: "2026-10-25" } });
    expect(headerOf(mocks.fetch.mock.calls[0]!)).toBe(token);
    expect(out.summary).toEqual({ avg: 3 });
    expect(out.races[0].predictedTop4).toHaveLength(4);
    const r2 = out.races[1];
    expect(r2.redacted).toBe(true);
    for (const k of ["predictedTop4", "predictedFifth", "boxPayouts", "scoreSource", "ensembleAlpha", "top4IntersectCount", "quinellaHit"]) expect(r2).not.toHaveProperty(k);
    expect(r2.actualTop4.every((a: object) => !("hit" in a))).toBe(true);
    expect(r2.actualTop4.map((a: { horseNumber: number }) => a.horseNumber)).toEqual([1, 2, 3, 6]);
  });
  it.each(["registered", "pro"])("%s 收到完整回應", async (tier) => {
    mocks.tier.mockResolvedValue(tier);
    const out = await (getMeetingHitRate as any)({ data: { date: "2026-10-25" } });
    expect(out.races[1].predictedTop4).toHaveLength(4);
    expect(out.races[1].redacted).toBeUndefined();
  });
  it("拒絕無效日期", async () => {
    await expect((async () => (getMeetingHitRate as any)({ data: { date: "2026-10-25&x=1" } }))()).rejects.toThrow();
  });
});

describe('today-picks 實際請求憑證回歸', () => {
  it('全日選馬讀取带網站憑證並保留40秒timeout及admin header', async () => {
    vi.stubEnv('TIANXI_ADMIN_TOKEN', 'test-admin-upstream');
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    mocks.fetch.mockImplementation(async (url: string) => url.includes('lock-state')
      ? { ok: true, json: async () => ({ locked: false }) }
      : { ok: true, text: async () => JSON.stringify({ races: [], noMeeting: true }) });
    try {
      expect(await fetchTodayPicksUpstream()).toMatchObject({ noMeeting: true });
      const call = mocks.fetch.mock.calls.find(c => String(c[0]).endsWith('/today-picks')) ?? [];
      expect(headerOf(call)).toBe(token);
      expect(new Headers(call[1]?.headers).get('authorization')).toBe('Bearer test-admin-upstream');
      expect(call[1]?.cache).toBe('no-store');
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
      expect(timeout).toHaveBeenCalledWith(40_000);
    } finally { timeout.mockRestore(); }
  });

  it.each([false, true])('監控選馬 fresh=%s 驗證admin後帶網站憑證', async fresh => {
    vi.stubEnv('TIANXI_ADMIN_TOKEN', 'test-admin-oracle');
    mocks.fetch.mockResolvedValue({ ok: true, text: async () => JSON.stringify({ races: [] }) });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { role: 'admin' }, error: null });
    const query = { select: () => query, eq: () => query, maybeSingle };
    const context = { userId: 'test-user', supabase: { from: () => query } };
    await (getOraclePicks as unknown as (input: unknown) => Promise<unknown>)({ data: { fresh }, context });
    expect(maybeSingle).toHaveBeenCalledTimes(1);
    const call = mocks.fetch.mock.calls[0] ?? [];
    expect(call[0]).toBe(`${TX_BASE}/api/analyze/today-picks${fresh ? '?fresh=1' : ''}`);
    expect(headerOf(call)).toBe(token);
    expect(new Headers(call[1]?.headers).get('authorization')).toBe('Bearer test-admin-oracle');
  });

  it('非Pro第1場解釋帶網站唯讀憑證，保留no-store及15秒timeout，不帶admin', async () => {
    vi.stubEnv('TIANXI_ADMIN_TOKEN', 'test-admin-not-for-evidence');
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    mocks.pro.mockResolvedValue(false);
    mocks.query.mockImplementation(async (sql: string) => {
      if (sql.includes('COUNT(DISTINCT venue)')) return [{ count: 1 }];
      if (sql.includes('prediction_original_snapshots')) return [{ snapshot_json: '{}', sha256: 'test', ok: 1 }];
      if (sql.includes('horse_pedigree')) return [{ horseElo: 1500, rank: 1 }];
      return [];
    });
    mocks.validate.mockResolvedValue({ venue: 'ST', rows: [{ race_number: 1, horse_id: 'horse_K585' }] });
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ frozen: true, date: '2026-10-25', venue: 'ST', races: [{ raceNumber: 1, picks: [{ horseId: 'horse_K585' }] }] }) });
    try {
      const out = await getLockedEvidence({ data: { raceId: 'race_2026-10-25_ST_1', horseId: 'horse_K585' } });
      expect(out).toMatchObject({ horseElo: 1500 });
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      const call = mocks.fetch.mock.calls[0] ?? [];
      expect(call[0]).toBe(`${TX_BASE}/api/analyze/today-picks`);
      expect(headerOf(call)).toBe(token);
      expect(new Headers(call[1]?.headers).get('authorization')).toBeNull();
      expect(call[1]?.cache).toBe('no-store');
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
      expect(timeout).toHaveBeenCalledWith(15_000);
    } finally { timeout.mockRestore(); }
  });

  it.each([false, true])('馬會改動檢查 fresh=%s 帶網站憑證，保留既有admin用途及timeout', async fresh => {
    vi.stubEnv('TIANXI_ADMIN_TOKEN', 'test-admin-recompute');
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    mocks.rpc.mockImplementation(async (name: string) => ({ error: null, data: name === 'claim_racing_prelock' ? {} : true }));
    mocks.prelock.mockImplementation(async (_date: string, state: object, deps: { read: (fresh: boolean) => Promise<unknown> }) => {
      expect(await deps.read(fresh)).toEqual([]);
      return { ...state, phase: 'clean' };
    });
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ date: '2026-10-25', generatedAt: '2026-10-25T02:00:00Z', races: [{ raceNumber: 1, picks: [1, 2, 3, 4].map(horseNumber => ({ horseNumber, nameCh: '測試馬' })) }] }) });
    try {
      expect(await recomputeIfStaleBeforeLock([], '2026-10-25')).toMatchObject({ action: 'clean', freezeAuthorized: false });
      expect(mocks.fetch).toHaveBeenCalledTimes(1);
      const call = mocks.fetch.mock.calls[0] ?? [];
      expect(call[0]).toBe(`${TX_BASE}/api/analyze/today-picks${fresh ? '?fresh=1' : ''}`);
      expect(headerOf(call)).toBe(token);
      expect(new Headers(call[1]?.headers).get('authorization')).toBe('Bearer test-admin-recompute');
      expect(call[1]?.cache).toBe('no-store');
      expect(call[1]?.signal).toBeInstanceOf(AbortSignal);
      expect(timeout).toHaveBeenCalledWith(fresh ? 45_000 : 15_000);
    } finally { timeout.mockRestore(); }
  });
});

describe("分層對帳", () => {
  beforeEach(() => {
    mocks.fetch.mockImplementation(async (url: string) => {
      if (url.includes("hit-rate-rollup")) return { ok: true, json: async () => ({ perMeeting: [{ date: "2026-10-25", venue: "ST" }] }) };
      if (url.includes("hit-rate?date")) return { ok: true, json: async () => ({ venue: "ST", races: [race(1), race(2)].map(r => ({ ...r, originalTop4: [1, 2, 3, 4] })) }) };
      return { ok: true, text: async () => "date,race_no\n" };
    });
  });
  it("Worker 請求帶憑證，GitHub 賽果檔唔帶", async () => {
    await readCoverageAudit(30, true);
    for (const call of mocks.fetch.mock.calls) {
      expect(headerOf(call)).toBe(String(call[0]).startsWith(TX_BASE) ? token : null);
    }
    expect(mocks.fetch.mock.calls.some(c => String(c[0]).includes("githubusercontent"))).toBe(true);
  });
  it("訪客只見第1場四揀；登記會員完整", async () => {
    // 快取回傳完整結果，分級喺快取之後做
    const full0 = { rows: [], meetings: [{ date: "2026-10-25", venue: "ST", races: [race(1), race(2)].map(r => ({ ...r, originalTop4: [1, 2, 3, 4] })) }] };
    mocks.cached.mockImplementation(() => structuredClone(full0));
    mocks.tier.mockResolvedValue("guest");
    const guest = await (getCoverageAudit as any)({ data: { days: 30 } });
    const races = guest.meetings[0].races;
    expect(races[0].predictedTop4).toHaveLength(4);
    expect(races[1]).not.toHaveProperty("predictedTop4");
    expect(races[1]).not.toHaveProperty("originalTop4");
    mocks.tier.mockResolvedValue("registered");
    const full = await (getCoverageAudit as any)({ data: { days: 30 } });
    expect(full.meetings[0].races[1].predictedTop4).toHaveLength(4);
  });
});

describe("靜態洩漏檢查", () => {
  const files: string[] = [];
  const walk = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(f)) files.push(p); } };
  walk("src");
  it("憑證名只出現喺伺服器檔案，冇 VITE_ 版本", () => {
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(s.includes("VITE_SITE_READER_TOKEN") && !f.endsWith(".test.ts"), f).toBe(false);
      if (/\.test\.tsx?$/.test(f)) continue;
      if (s.includes("SITE_READER_TOKEN")) expect(/\.(server|functions)\.ts$/.test(f), f).toBe(true);
    }
  });
  it("瀏覽器檔案唔直接 import 憑證模組、唔直接讀 hit-rate", () => {
    for (const f of files) {
      if (/\.(server|functions)\.ts$|\.test\.tsx?$/.test(f) || f.startsWith('src/routes/api/')) continue;
      const s = readFileSync(f, "utf8");
      expect(/site-reader\.server/.test(s), f).toBe(false);
      expect(/\/api\/analyze\/hit-rate\?/.test(s), f).toBe(false);
    }
  });
});
