import { describe, expect, it } from "vitest";
import {
  dropReleasedOrphans,
  migrateSnapshot,
  monthKeysThrough,
  normalizeItem,
  reapplySetMonths,
  toggleIdsInMonth,
  toggleSetMonthIds,
} from "./ledgerData";
import { INCOME_START } from "./format";
import type { FixedItem } from "./schedule";

describe("ledgerData", () => {
  it("monthKeysThrough starts at INCOME_START", () => {
    const keys = monthKeysThrough(new Date(2026, 10, 1));
    expect(keys[0]).toBe(`${INCOME_START.year}-${String(INCOME_START.month).padStart(2, "0")}`);
    expect(keys).toContain("2026-11");
  });

  it("migrateSnapshot remaps legacy categories and seeds missing assignments", () => {
    const data = migrateSnapshot({
      version: 1,
      items: [
        {
          id: "a",
          name: "X",
          amount: 1,
          cycle: "monthly",
          day: 1,
          weekday: 1,
          month: 1,
          category: "소프트웨어",
          note: "",
        },
      ],
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

  it("dropReleasedOrphans only removes exclusive released ids", () => {
    const draft: FixedItem = {
      id: "draft",
      name: "Draft",
      amount: 1,
      cycle: "monthly",
      day: 1,
      weekday: 1,
      month: 1,
      category: "기타",
      note: "",
    };
    const a: FixedItem = { ...draft, id: "a", name: "A" };
    const b: FixedItem = { ...draft, id: "b", name: "B" };
    const data = {
      items: [a, b, draft],
      sets: [{ id: "s2", name: "Keep", itemIds: ["b"], createdAt: "" }],
      assignments: { "2026-09": ["a", "b", "draft"] },
    };
    dropReleasedOrphans(data, ["a", "b"]);
    expect(data.items.map((it) => it.id).sort()).toEqual(["b", "draft"]);
    expect(data.assignments["2026-09"]).toEqual(expect.arrayContaining(["b", "draft"]));
    expect(data.assignments["2026-09"]).not.toContain("a");
  });

  it("toggleSetMonthIds keeps shared ids when another set stays fully applied", () => {
    const assignments: Record<string, string[]> = { "2026-09": ["a", "b", "c"] };
    const sets = [
      { id: "s1", name: "A", itemIds: ["a", "b"], createdAt: "" },
      { id: "s2", name: "B", itemIds: ["b", "c"], createdAt: "" },
    ];
    toggleSetMonthIds(assignments, sets, "s1", "2026-09", ["a", "b"]);
    expect(assignments["2026-09"]).toEqual(expect.arrayContaining(["b", "c"]));
    expect(assignments["2026-09"]).not.toContain("a");
  });

  it("normalizeItem remaps category and clamps cycle", () => {
    const row = normalizeItem({
      id: "x",
      name: "  x  ",
      amount: Number.NaN,
      cycle: "nope" as FixedItem["cycle"],
      day: 99,
      weekday: 9,
      month: 0,
      category: "소프트웨어",
      note: "  n  ",
    });
    expect(row.name).toBe("x");
    expect(row.amount).toBe(0);
    expect(row.cycle).toBe("monthly");
    expect(row.day).toBe(31);
    expect(row.weekday).toBe(6);
    expect(row.month).toBe(1);
    expect(row.category).toBe("구독");
    expect(row.note).toBe("n");
  });
});
