import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  requireTier: vi.fn((..._args: unknown[]) => ({})),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder: any = {
      middleware: (m: unknown) => {
        builder._middleware = m;
        return builder;
      },
      inputValidator: (v: (i: unknown) => unknown) => {
        builder.v = v;
        return builder;
      },
      handler: (h: (a: { data: unknown }) => unknown) => (input: { data: unknown }) =>
        h({ data: builder.v(input.data) }),
    };
    return builder;
  },
}));

vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("./tier.server", () => ({
  requireTier: (...args: unknown[]) => mocks.requireTier(...args),
}));
vi.mock("./site-reader.server", async () => {
  const actual = await vi.importActual<typeof import("./site-reader.server")>(
    "./site-reader.server",
  );
  return {
    ...actual,
    workerFetch: (url: string, init?: RequestInit) => mocks.fetch(url, init),
    WORKER_BASE: "https://worker.test",
  };
});

import { optimizeLabPools } from "./lab-pools.functions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireTier.mockReturnValue({});
  vi.stubEnv("SITE_READER_TOKEN", "site-test-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lab-pools.functions", () => {
  it("requireTier(pro) wired in source", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/lab-pools.functions.ts", "utf8");
    expect(src).toContain('requireTier("pro")');
  });

  it("optimizeLabPools 打 /api/lab/pools/optimize 並保留無 bet URL", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          pool: "FF",
          method: "top_k",
          budget: 100,
          raceIds: ["race_2026-10-25_ST_1"],
          combos: [],
          totalCost: 0,
          totalModelHitProbProxy: 0,
          warnings: [],
          model: "harville",
          disclaimer: "研究用",
          researchBanner: "研究用・唔係官方建議・唔入公開戰績",
          scope: "single-race",
          betUrl: null,
          placeBetUrl: null,
        }),
        { status: 200 },
      ),
    );
    const data = await optimizeLabPools({
      data: {
        pool: "FF",
        raceIds: ["race_2026-10-25_ST_1"],
        budget: 100,
        method: "top_k",
      },
    });
    expect(data.betUrl).toBeNull();
    expect(data.placeBetUrl).toBeNull();
    expect(data.researchBanner).toContain("研究用");
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/lab/pools/optimize");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      pool: "FF",
      raceIds: ["race_2026-10-25_ST_1"],
      budget: 100,
      method: "top_k",
    });
  });

  it("Worker 錯誤 → throw", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "未凍結" }), { status: 403 }),
    );
    await expect(
      optimizeLabPools({
        data: { pool: "FF", raceIds: ["race_x"], budget: 50 },
      }),
    ).rejects.toThrow(/未凍結|優化失敗/);
  });
});
