import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => {
  const state = {
    strategies: [] as Row[],
    versions: [] as Row[],
  };

  function thenable(result: { data: unknown; error: unknown }) {
    const q: any = {
      select() {
        return q;
      },
      insert(payload: Row | Row[]) {
        q._op = "insert";
        q._payload = payload;
        return q;
      },
      update(payload: Row) {
        q._op = "update";
        q._payload = payload;
        return q;
      },
      delete() {
        q._op = "delete";
        return q;
      },
      eq(col: string, val: unknown) {
        q._filters.push({ col, val });
        return q;
      },
      in(col: string, vals: unknown[]) {
        q._filters.push({ col, vals, op: "in" });
        return q;
      },
      order() {
        return q;
      },
      maybeSingle: async () => {
        const rows = q._resolveRows();
        return { data: rows[0] ?? null, error: null };
      },
      single: async () => {
        const rows = q._resolveRows();
        if (!rows[0]) return { data: null, error: { message: "not found" } };
        return { data: rows[0], error: null };
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        return Promise.resolve({ data: q._resolveRows(), error: null }).then(resolve, reject);
      },
      _table: "" as string,
      _op: "select" as string,
      _payload: null as unknown,
      _filters: [] as { col: string; val?: unknown; vals?: unknown[]; op?: string }[],
      _resolveRows() {
        const table = q._table === "user_strategies" ? state.strategies : state.versions;
        if (q._op === "insert") {
          const items = Array.isArray(q._payload) ? q._payload : [q._payload];
          const created: Row[] = [];
          for (const item of items) {
            const row: Row = {
              id:
                (item as Row)['id'] ??
                (q._table === "user_strategies"
                  ? `aaaaaaaa-bbbb-4ccc-8ddd-${String(state.strategies.length + 1).padStart(12, "0")}`
                  : undefined),
              created_at: "2026-10-26T00:00:00Z",
              updated_at: "2026-10-26T00:00:00Z",
              ...item,
            };
            if (q._table === "user_strategies") state.strategies.push(row);
            else state.versions.push(row);
            created.push(row);
          }
          return created;
        }
        if (q._op === "update") {
          const matches = table.filter((r) =>
            q._filters.every((f: { col: string; val?: unknown }) => r[f.col] === f.val),
          );
          for (const m of matches) Object.assign(m, q._payload, { updated_at: "2026-10-26T01:00:00Z" });
          return matches;
        }
        if (q._op === "delete") {
          const keep: Row[] = [];
          const removed: Row[] = [];
          for (const r of table) {
            const match = q._filters.every((f: { col: string; val?: unknown }) => r[f.col] === f.val);
            if (match) removed.push(r);
            else keep.push(r);
          }
          if (q._table === "user_strategies") state.strategies = keep;
          else state.versions = keep;
          return removed;
        }
        // select
        return table.filter((r) =>
          q._filters.every((f: { col: string; val?: unknown; vals?: unknown[]; op?: string }) => {
            if (f.op === "in") return (f.vals ?? []).includes(r[f.col]);
            return r[f.col] === f.val;
          }),
        );
      },
    };
    return q;
  }

  const from = vi.fn((table: string) => {
    const q = thenable({ data: null, error: null });
    q._table = table;
    return q;
  });

  return {
    state,
    from,
    requireTier: vi.fn((..._args: unknown[]) => ({})),
    reset() {
      state.strategies = [];
      state.versions = [];
      from.mockClear();
    },
  };
});

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
        (h: (a: { data: unknown; context?: Record<string, unknown> }) => unknown) =>
        (input: { data?: unknown; context?: Record<string, unknown> } = {}) => {
          const payload: { data: unknown; context?: Record<string, unknown> } = {
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

import {
  deleteUserStrategy,
  listUserStrategies,
  listUserStrategyVersions,
  migrateLocalStrategies,
  upsertUserStrategy,
} from "./user-strategies.functions";

function ctx() {
  return {
    userId: "user-1",
    supabase: { from: mocks.from },
  };
}

beforeEach(() => {
  mocks.requireTier.mockClear();
  mocks.requireTier.mockReturnValue({});
  mocks.reset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("user-strategies.functions requireTier", () => {
  it("list／upsert／delete／versions／migrate 都要求 pro", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/lib/user-strategies.functions.ts", "utf8");
    const hits = src.match(/requireTier\("pro"\)/g) ?? [];
    expect(hits.length).toBe(5);
  });
});

describe("user-strategies.functions handlers", () => {
  it("listUserStrategies 空表", async () => {
    const out = await (listUserStrategies as any)({ context: ctx() });
    expect(out).toEqual({ strategies: [], source: "cloud" });
  });

  it("upsertUserStrategy 新建並寫 version", async () => {
    const out = await (upsertUserStrategy as any)({
      data: {
        name: "均衡四揀",
        note: "demo",
        weights: [
          { id: "careerWin", weight: 2 },
          { id: "form", weight: 1 },
        ],
        pools: ["FF", "TRIO"],
      },
      context: ctx(),
    });
    expect(out.source).toBe("cloud");
    expect(out.strategy.name).toBe("均衡四揀");
    expect(out.strategy.version).toBe(1);
    expect(out.strategy.weights.map((w: { id: string }) => w.id)).toEqual(["careerWin", "form"]);
    expect(out.strategy.pools).toEqual(["FF", "TRIO"]);
    expect(mocks.state.strategies).toHaveLength(1);
    expect(mocks.state.versions).toHaveLength(1);
    expect(mocks.state.versions[0]?.['version']).toBe(1);
  });

  it("upsertUserStrategy 拒絕非法 FeatureId", () => {
    expect(() =>
      (upsertUserStrategy as any)({
        data: {
          name: "bad",
          weights: [{ id: "elo", weight: 2 }],
        },
        context: ctx(),
      }),
    ).toThrow(/Invalid option|elo/i);
  });

  it("upsertUserStrategy 更新升版", async () => {
    const created = await (upsertUserStrategy as any)({
      data: {
        name: "v1",
        weights: [{ id: "draw", weight: 1 }],
        pools: ["FF"],
      },
      context: ctx(),
    });
    const id = created.strategy.id as string;
    const updated = await (upsertUserStrategy as any)({
      data: {
        id,
        name: "v2",
        weights: [
          { id: "draw", weight: 2 },
          { id: "distance", weight: 1 },
        ],
        pools: ["FF", "QUARTET"],
      },
      context: ctx(),
    });
    expect(updated.strategy.version).toBe(2);
    expect(updated.strategy.name).toBe("v2");
    expect(mocks.state.versions).toHaveLength(2);
    expect(updated.strategy.weights.map((w: { id: string }) => w.id)).toEqual(["draw", "distance"]);
  });

  it("listUserStrategies 帶最新 weights", async () => {
    await (upsertUserStrategy as any)({
      data: {
        name: "A",
        weights: [{ id: "form", weight: 1 }],
        pools: ["FF"],
      },
      context: ctx(),
    });
    const listed = await (listUserStrategies as any)({ context: ctx() });
    expect(listed.strategies).toHaveLength(1);
    expect(listed.strategies[0].weights[0].id).toBe("form");
    expect(listed.source).toBe("cloud");
  });

  it("deleteUserStrategy 刪除", async () => {
    const created = await (upsertUserStrategy as any)({
      data: {
        name: "del",
        weights: [{ id: "time", weight: 1 }],
      },
      context: ctx(),
    });
    const id = created.strategy.id as string;
    const out = await (deleteUserStrategy as any)({ data: { id }, context: ctx() });
    expect(out).toEqual({ ok: true });
    expect(mocks.state.strategies).toHaveLength(0);
  });

  it("listUserStrategyVersions 按版列出", async () => {
    const created = await (upsertUserStrategy as any)({
      data: {
        name: "hist",
        weights: [{ id: "jt", weight: 1 }],
        pools: ["TRIO"],
      },
      context: ctx(),
    });
    const id = created.strategy.id as string;
    await (upsertUserStrategy as any)({
      data: {
        id,
        name: "hist",
        weights: [{ id: "jt", weight: 2 }],
        pools: ["TRIO"],
      },
      context: ctx(),
    });
    const vers = await (listUserStrategyVersions as any)({ data: { id }, context: ctx() });
    expect(vers.versions).toHaveLength(2);
    expect(vers.versions.map((v: { version: number }) => v.version).sort()).toEqual([1, 2]);
  });

  it("migrateLocalStrategies 批次 upsert", async () => {
    const out = await (migrateLocalStrategies as any)({
      data: {
        strategies: [
          {
            name: "本機甲",
            weights: [{ id: "careerWin", weight: 2 }, { id: "form", weight: 1 }],
            pools: ["FF"],
          },
          {
            name: "本機乙",
            note: "from local",
            weights: [{ id: "draw", weight: 1 }],
          },
        ],
      },
      context: ctx(),
    });
    expect(out.skipped).toBe(0);
    expect(out.migrated).toHaveLength(2);
    expect(out.migrated.map((s: { name: string }) => s.name)).toEqual(["本機甲", "本機乙"]);
    expect(mocks.state.strategies).toHaveLength(2);
    expect(mocks.state.versions).toHaveLength(2);
  });
});
