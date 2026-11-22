import { describe, expect, it } from "vitest";
import { frozenSourceLabel, rebuildProvenance } from "./freeze-provenance";

const rebuilt = { provenance: { kind: "post-lock-rebuild", approvedAt: "2026-11-22T17:27:00Z", rebuiltAt: "2026-11-22T18:00:00Z" } };

describe("鎖後補建 provenance", () => {
  it("reads the label only from the snapshot's own provenance", () => {
    expect(rebuildProvenance(rebuilt)?.kind).toBe("post-lock-rebuild");
    expect(rebuildProvenance({})).toBeNull();
    expect(rebuildProvenance({ provenance: { kind: "post-lock-rebuild" } })).toBeNull();
    expect(rebuildProvenance({ provenance: { kind: "original", approvedAt: "2026-11-22T17:27:00Z", rebuiltAt: "2026-11-22T18:00:00Z" } })).toBeNull();
  });
  it("a rebuilt day is labelled 鎖後補建 and counted, never shown as an on-time original", () => {
    const label = frozenSourceLabel({ legacy: false, hasFrozen: true, rebuild: rebuildProvenance(rebuilt) });
    expect(label).toBe("鎖後補建副本（計入正式戰績）");
    expect(label).not.toBe("已核實原始凍結副本");
    expect(frozenSourceLabel({ legacy: false, hasFrozen: true, rebuild: null })).toBe("已核實原始凍結副本");
  });
});
