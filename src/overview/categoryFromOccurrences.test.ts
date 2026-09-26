import { describe, expect, it } from "vitest";
import { categoryFromOccurrences } from "./categoryFromOccurrences";
import type { FixedItem, Occurrence } from "../schedule";

function item(partial: Partial<FixedItem> & Pick<FixedItem, "id" | "category" | "amount">): FixedItem {
  return {
    name: partial.name ?? partial.id,
    cycle: "monthly",
    day: 1,
    weekday: 1,
    month: 1,
    note: "",
    active: true,
    ...partial,
  };
}

describe("categoryFromOccurrences", () => {
  it("sums only the given month occurrences", () => {
    const a = item({ id: "a", category: "통신", amount: 10_000, name: "A" });
    const b = item({ id: "b", category: "통신", amount: 20_000, name: "B" });
    const c = item({ id: "c", category: "구독", amount: 5_000, name: "C" });
    const occurrences: Occurrence[] = [
      { item: a, day: 1 },
      { item: b, day: 5 },
    ];
    expect(categoryFromOccurrences(occurrences)).toEqual([{ category: "통신", amount: 30_000 }]);
    // C exists in catalog but not in this month's occurrences
    void c;
  });
});
