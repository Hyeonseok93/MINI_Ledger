import { describe, expect, it } from "vitest";
import {
  migrateSnapshot,
  monthKeysThrough,
  reapplySetMonths,
  toggleIdsInMonth,
} from "./ledgerData";
import { INCOME_START } from "./format";

describe("ledgerData", () => {
  it("monthKeysThrough starts at INCOME_START", () => {
    const keys = monthKeysThrough(new Date(2026, 10, 1));
    expect(keys[0]).toBe(`${INCOME_START.year}-${String(INCOME_START.month).padStart(2, "0")}`);
    expect(keys).toContain("2026-11");
  });

  it("migrateSnapshot remaps legacy categories and seeds missing assignments", () => {
    const data = migrateSnapshot({
      version: 1,
      items: [{ id: "a", name: "X", amount: 1, cycle: "monthly", day: 1, weekday: 1, month: 1, category: "소프트웨어", note: "", active: true }],
    });
    expect(data.items[0].category).toBe("구독");
    expect(Object.keys(data.assignments).length).toBeGreaterThan(0);
    expect(data.assignments[Object.keys(data.assignments)[0]]).toContain("a");
  });

  it("reapplySetMonths keeps applied months in sync", () => {
    const data = {
      sets: [{ id: "s1", name: "S", itemIds: ["a", "c"], createdAt: "" }],
      assignments: { "2026-09": ["a", "b"] },
    };
    reapplySetMonths(data, ["a", "b"], ["a", "c"]);
    expect(data.assignments["2026-09"]).toEqual(expect.arrayContaining(["a", "c"]));
    expect(data.assignments["2026-09"]).not.toContain("b");
  });

  it("toggleIdsInMonth flips membership", () => {
    const assignments: Record<string, string[]> = {};
    toggleIdsInMonth(assignments, "2026-10", ["a", "b"]);
    expect(assignments["2026-10"]).toEqual(["a", "b"]);
    toggleIdsInMonth(assignments, "2026-10", ["a", "b"]);
    expect(assignments["2026-10"]).toBeUndefined();
  });
});
