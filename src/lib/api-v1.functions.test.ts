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
      handler:
        (h: (a: { data: unknown; context?: { userId: string } }) => unknown) =>
        (input: { data: unknown; context?: { userId: string } }) => {
          const payload: { data: unknown; context?: { userId: string } } = {
            data: builder.v ? builder.v(input.data) : input.data,
          };
          if (input.context) payload.context = input.context;
          return h(payload);
        },
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

import { createApiKey, listApiKeys, revokeApiKey } from "./api-v1.functions";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireTier.mockReturnValue({});
  vi.stubEnv("SITE_READER_TOKEN", "site-test-token");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("api-v1.functions requireTier", () => {
  it("create／list／revoke 都要求 pro", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/api-v1.functions.ts", "utf8");
    const hits = src.match(/requireTier\("pro"\)/g) ?? [];
    expect(hits.length).toBe(3);
  });
});

describe("api-v1.functions handlers", () => {
  it("createApiKey POST /api/v1/admin/keys", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "k1",
          keyPrefix: "tx_live_abcd",
          apiKey: "tx_live_abcd1234",
          scopes: "elo,picks,features",
          entitlementUntil: null,
          createdAt: "2026-10-26T00:00:00Z",
          label: "dev",
          note: "請立即保存",
          disclaimer: "研究",
        }),
        { status: 200 },
      ),
    );
    const out = await (createApiKey as any)({
      data: { label: "dev" },
      context: { userId: "user-1" },
    });
    expect(out.apiKey).toMatch(/^tx_live_/);
    expect(out.id).toBe("k1");
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://worker.test/api/v1/admin/keys");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({
      userId: "user-1",
      label: "dev",
    });
  });

  it("listApiKeys GET with userId", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          keys: [
            {
              id: "k1",
              keyPrefix: "tx_live_ab",
              scopes: "elo,picks,features",
              entitlementUntil: null,
              revokedAt: null,
              lastUsedAt: null,
              createdAt: "2026-10-26T00:00:00Z",
              label: null,
            },
          ],
          usage: [],
          limits: { perMinute: 60, perDay: 5000 },
        }),
        { status: 200 },
      ),
    );
    const out = await (listApiKeys as any)({
      data: undefined,
      context: { userId: "user-1" },
    });
    expect(out.keys).toHaveLength(1);
    expect(out.limits.perDay).toBe(5000);
    const called = String(mocks.fetch.mock.calls[0]?.[0]);
    expect(called).toContain("/api/v1/admin/keys?");
    expect(called).toContain("userId=user-1");
  });

  it("revokeApiKey POST revoke path", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({ id: "k1", revokedAt: "2026-10-26T12:00:00Z", alreadyRevoked: false }),
        { status: 200 },
      ),
    );
    const out = await (revokeApiKey as any)({ data: { id: "k1" } });
    expect(out.id).toBe("k1");
    expect(out.revokedAt).toBeTruthy();
    const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://worker.test/api/v1/admin/keys/k1/revoke");
    expect(init?.method).toBe("POST");
  });

  it("create 失敗 → throw", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "配額已滿" }), { status: 403 }),
    );
    await expect(
      (createApiKey as any)({ data: {}, context: { userId: "u" } }),
    ).rejects.toThrow(/配額已滿|建立失敗/);
  });
});
