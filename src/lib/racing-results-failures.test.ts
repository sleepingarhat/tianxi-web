import { describe, it, expect, vi } from "vitest";
import {
  alertOnce,
  collectPendingRaces,
  raceFailureAlertKey,
  raceFailureAlertText,
  raceStartedAt,
  resultErrorCode,
  suppressRaceFailureAlert,
  type AlertStore,
} from "./racing-results-failures";

const ok = (n: number) => ({ raceNumber: n, action: "archived-identity-verified", sha256: "x" });

describe("per-race isolation in the completion-check job", () => {
  it("a failing race is recorded and skipped; the next race still archives", async () => {
    const collect = vi.fn(async (n: number) => {
      if (n === 9) throw new Error("official-result-runner-invalid");
      return ok(n);
    });
    const out = await collectPendingRaces("2026-10-21", "HV", [10, 9, 11], collect);
    expect(collect.mock.calls.map((c) => c[0])).toEqual([9, 10]);
    expect(out.archived).toMatchObject({ raceNumber: 10 });
    expect(out.failures).toEqual([
      { date: "2026-10-21", venue: "HV", raceNumber: 9, code: "official-result-runner-invalid" },
    ]);
  });
  it("lease-held races are skipped, not treated as progress", async () => {
    const out = await collectPendingRaces("d", "ST", [1, 2], async (n) =>
      n === 1 ? { raceNumber: 1, action: "lease-active" } : ok(n),
    );
    expect(out.archived).toMatchObject({ raceNumber: 2 });
  });
  it("attempts per tick are bounded", async () => {
    const collect = vi.fn(async () => {
      throw new Error("official-result-http-503");
    });
    const out = await collectPendingRaces("d", "ST", [1, 2, 3, 4, 5, 6], collect, 4);
    expect(collect).toHaveBeenCalledTimes(4);
    expect(out.archived).toBeNull();
    expect(out.failures.map((f) => f.raceNumber)).toEqual([1, 2, 3, 4]);
  });
  it("nothing pending is a no-op", async () => {
    expect(await collectPendingRaces("d", "ST", [], async (n) => ok(n))).toEqual({
      archived: null,
      attempts: [],
      failures: [],
    });
  });
});

describe("error codes", () => {
  it("passes our own codes, hides arbitrary messages", () => {
    expect(resultErrorCode(new Error("official-result-runner-invalid"))).toBe(
      "official-result-runner-invalid",
    );
    expect(
      resultErrorCode(new Error('duplicate key value violates "secret_table" token=abc')),
    ).toBe("unexpected-error");
    expect(
      resultErrorCode(
        Object.assign(new Error("The operation was aborted due to timeout"), {
          name: "TimeoutError",
        }),
      ),
    ).toBe("official-result-timeout");
    expect(resultErrorCode("boom")).toBe("unexpected-error");
  });
  it("alert names date, venue, race and code", () => {
    const f = {
      date: "2026-10-21",
      venue: "HV",
      raceNumber: 9,
      code: "official-result-runner-invalid",
    };
    expect(raceFailureAlertKey(f)).toBe(
      "results-race-failure:2026-10-21:HV:R9:official-result-runner-invalid",
    );
    const text = raceFailureAlertText(f);
    for (const part of [
      "2026-10-21",
      "HV",
      "第9場",
      "official-result-runner-invalid",
      "原凍結不改",
    ])
      expect(text).toContain(part);
  });
});

describe("race start times", () => {
  it("parses ISO timestamps and HKT clock times", () => {
    expect(raceStartedAt("2026-10-25T13:00:00+08:00", "2026-10-25")).toBe(
      Date.parse("2026-10-25T13:00:00+08:00"),
    );
    expect(raceStartedAt("13:00", "2026-10-25")).toBe(Date.parse("2026-10-25T13:00:00+08:00"));
    expect(raceStartedAt("13:00:30", "2026-10-25")).toBe(Date.parse("2026-10-25T13:00:00+08:00"));
  });
  it("rejects missing or unparseable times", () => {
    expect(raceStartedAt(null, "2026-10-25")).toBeNull();
    expect(raceStartedAt("", "2026-10-25")).toBeNull();
    expect(raceStartedAt("soon", "2026-10-25")).toBeNull();
    expect(raceStartedAt("13:00", "25/10/2026")).toBeNull();
  });
});

describe("transient alert suppression", () => {
  const started = new Map([[3, Date.parse("2026-10-25T14:30:00+08:00")]]);
  const within = new Date(Date.parse("2026-10-25T14:40:00+08:00"));
  const after = new Date(Date.parse("2026-10-25T14:55:00+08:00"));
  const failure = (code: string, raceNumber = 3) => ({ date: "2026-10-25", venue: "ST", raceNumber, code });
  it("table-missing and columns-incomplete are suppressed within 20 minutes of the off", () => {
    expect(suppressRaceFailureAlert(failure("official-result-table-missing"), started, within)).toBe(true);
    expect(suppressRaceFailureAlert(failure("official-result-columns-incomplete"), started, within)).toBe(true);
  });
  it("the same codes alert again after the grace window", () => {
    expect(suppressRaceFailureAlert(failure("official-result-table-missing"), started, after)).toBe(false);
    expect(suppressRaceFailureAlert(failure("official-result-columns-incomplete"), started, after)).toBe(false);
  });
  it("a timeout before race 1 is suppressed; once any race started it alerts", () => {
    expect(suppressRaceFailureAlert(failure("official-result-timeout", 1), new Map(), within)).toBe(true);
    expect(suppressRaceFailureAlert(failure("official-result-timeout", 1), started, within)).toBe(false);
  });
  it("unknown timing never suppresses", () => {
    expect(suppressRaceFailureAlert(failure("official-result-table-missing"), null, within)).toBe(false);
    expect(suppressRaceFailureAlert(failure("official-result-timeout"), null, within)).toBe(false);
  });
  it("other failure codes always alert", () => {
    expect(suppressRaceFailureAlert(failure("official-result-identity-mismatch"), started, within)).toBe(false);
    expect(suppressRaceFailureAlert(failure("unexpected-error"), new Map(), within)).toBe(false);
  });
});

describe("alertOnce dedupe", () => {
  const memoryStore = (sent = true) => {
    const state = new Map<string, Record<string, unknown>>();
    const send = vi.fn(async () => ({ sent }));
    const store: AlertStore = {
      read: async (k) => (state.get(k) as { sentAt?: string }) ?? null,
      write: async (k, v) => {
        state.set(k, v);
      },
      send,
    };
    return { store, send, state };
  };
  it("each distinct key alerts once across ticks", async () => {
    const { store, send } = memoryStore();
    expect(await alertOnce("k1", "a", store)).toBe("sent");
    expect(await alertOnce("k1", "a", store)).toBe("deduped");
    expect(await alertOnce("k2", "b", store)).toBe("sent");
    expect(send).toHaveBeenCalledTimes(2);
  });
  it("failed delivery is not recorded, so the next tick retries", async () => {
    const { store, state } = memoryStore(false);
    expect(await alertOnce("k", "a", store)).toBe("send-failed");
    expect(state.has("k")).toBe(false);
  });
  it("unreadable state still alerts (fail open)", async () => {
    const send = vi.fn(async () => ({ sent: true }));
    const store: AlertStore = {
      read: async () => {
        throw new Error("alert-state-unreadable");
      },
      write: async () => undefined,
      send,
    };
    expect(await alertOnce("k", "a", store)).toBe("sent");
  });
});
