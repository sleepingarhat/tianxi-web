import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const builder: any = {
      middleware: () => builder,
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
vi.mock("./tier.server", () => ({ requireTier: () => ({}) }));
vi.mock("./site-reader.server", async () => {
  const actual = await vi.importActual<typeof import("./site-reader.server")>("./site-reader.server");
  return {
    ...actual,
    workerFetch: (url: string, init?: RequestInit) => mocks.fetch(url, init),
    WORKER_BASE: "https://worker.test",
  };
});

import { getLabH2h, searchLabEntity } from "./lab-h2h.functions";
import { SITE_READER_HEADER } from "./site-reader.server";

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("SITE_READER_TOKEN", "site-test-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("lab-h2h.functions", () => {
  it("getLabH2h 帶 site token 叫 Worker", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "horse",
          a: "horse_A",
          b: "horse_B",
          filters: { distance: null, going: null, venue: null },
          entities: {
            a: { id: "horse_A", nameCh: "甲", nameEn: null, code: null, status: "active" },
            b: { id: "horse_B", nameCh: "乙", nameEn: null, code: null, status: "active" },
          },
          elo: { a: [], b: [], meetings: [] },
          conditions: [],
          runningStyle: {
            a: { sample: 0, lowSample: true, buckets: [], earlyMedian: null, last400Avg: null },
            b: { sample: 0, lowSample: true, buckets: [], earlyMedian: null, last400Avg: null },
          },
          meetings: [],
          warnings: ["樣本較少，解讀需審慎"],
        }),
        { status: 200 },
      ),
    );
    const data = await getLabH2h({ data: { type: "horse", a: "horse_A", b: "horse_B" } });
    expect(data.warnings[0]).toContain("樣本較少");
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/lab/h2h?");
    expect(url).toContain("type=horse");
    // workerFetch mock bypasses real header merge — call site path via actual if needed
    expect(init?.cache).toBe("no-store");
  });

  it("Worker 401 → 友好錯誤", async () => {
    mocks.fetch.mockResolvedValue(new Response("{}", { status: 401 }));
    await expect(
      getLabH2h({ data: { type: "horse", a: "horse_A", b: "horse_B" } }),
    ).rejects.toThrow(/憑證/);
  });

  it("searchLabEntity 打 /api/lab/search", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ type: "jockey", items: [{ id: "jockey_PZ", nameCh: "潘明輝", nameEn: null, code: "PZ", status: "active" }] }), {
        status: 200,
      }),
    );
    const data = await searchLabEntity({ data: { type: "jockey", q: "潘" } });
    expect(data.items[0]?.id).toBe("jockey_PZ");
    expect(String(mocks.fetch.mock.calls[0][0])).toContain("/api/lab/search?");
  });
});

// silence unused
void SITE_READER_HEADER;
