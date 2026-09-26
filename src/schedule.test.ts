import { describe, expect, it } from "vitest";
import {
  analyze,
  daysInMonth,
  daysUntil,
  dueWithin,
  fixedInMonth,
  incomeFor,
  monthKey,
  nextOccurrence,
  occurrencesInMonth,
  perMonth,
  perYear,
  quarterMonths,
  upcomingInWindow,
  upcomingWindowBounds,
  whenLabel,
  type FixedItem,
} from "./schedule";

function item(partial: Partial<FixedItem> & Pick<FixedItem, "cycle">): FixedItem {
  return {
    id: partial.id ?? "x",
    name: partial.name ?? "item",
    amount: partial.amount ?? 10_000,
    cycle: partial.cycle,
    day: partial.day ?? 15,
    weekday: partial.weekday ?? 1,
    month: partial.month ?? 1,
    category: partial.category ?? "구독",
    note: partial.note ?? "",
    active: partial.active ?? true,
  };
}

describe("monthKey / incomeFor", () => {
  it("pads month keys", () => {
    expect(monthKey(2026, 1)).toBe("2026-01");
    expect(monthKey(2026, 10)).toBe("2026-10");
  });

  it("uses month override then base", () => {
    const income = { base: 3_000_000, months: { "2026-11": 2_500_000 } };
    expect(incomeFor(income, 2026, 10)).toBe(3_000_000);
    expect(incomeFor(income, 2026, 11)).toBe(2_500_000);
  });
});

describe("perMonth / perYear", () => {
  it("converts cycles to monthly and yearly totals", () => {
    expect(perMonth(item({ cycle: "monthly", amount: 12_000 }))).toBe(12_000);
    expect(perYear(item({ cycle: "monthly", amount: 12_000 }))).toBe(144_000);
    expect(perMonth(item({ cycle: "yearly", amount: 120_000 }))).toBe(10_000);
    expect(perMonth(item({ cycle: "quarterly", amount: 30_000 }))).toBe(10_000);
    expect(perMonth(item({ cycle: "weekly", amount: 10_000 }))).toBeCloseTo((10_000 * 52) / 12);
    expect(perMonth(item({ cycle: "daily", amount: 1_000 }))).toBeCloseTo((1_000 * 365) / 12);
  });
});

describe("quarterMonths", () => {
  it("returns the four months for an anchor", () => {
    expect(quarterMonths(1)).toEqual([1, 4, 7, 10]);
    expect(quarterMonths(2)).toEqual([2, 5, 8, 11]);
    expect(quarterMonths(3)).toEqual([3, 6, 9, 12]);
    expect(quarterMonths(4)).toEqual([1, 4, 7, 10]);
  });
});

describe("daysInMonth", () => {
  it("handles leap years and 31-day months", () => {
    expect(daysInMonth(2024, 1)).toBe(29); // Feb 2024
    expect(daysInMonth(2025, 1)).toBe(28); // Feb 2025
    expect(daysInMonth(2026, 0)).toBe(31); // Jan
    expect(daysInMonth(2026, 3)).toBe(30); // Apr
  });
});

describe("occurrencesInMonth", () => {
  it("daily fills every day", () => {
    expect(occurrencesInMonth(item({ cycle: "daily" }), 2026, 8)).toHaveLength(30); // Sep
  });

  it("weekly hits matching weekdays", () => {
    // Sep 2026 starts Tuesday; weekday 1 = Monday → 7,14,21,28
    expect(occurrencesInMonth(item({ cycle: "weekly", weekday: 1 }), 2026, 8)).toEqual([7, 14, 21, 28]);
  });

  it("monthly clamps day to month length", () => {
    expect(occurrencesInMonth(item({ cycle: "monthly", day: 31 }), 2026, 1)).toEqual([28]); // Feb 2026
    expect(occurrencesInMonth(item({ cycle: "monthly", day: 15 }), 2026, 0)).toEqual([15]);
  });

  it("quarterly only fires in quarter months", () => {
    const q = item({ cycle: "quarterly", month: 1, day: 10 });
    expect(occurrencesInMonth(q, 2026, 0)).toEqual([10]); // Jan
    expect(occurrencesInMonth(q, 2026, 1)).toEqual([]); // Feb
    expect(occurrencesInMonth(q, 2026, 3)).toEqual([10]); // Apr
  });

  it("yearly only fires in matching month", () => {
    const y = item({ cycle: "yearly", month: 3, day: 20 });
    expect(occurrencesInMonth(y, 2026, 2)).toEqual([20]); // Mar
    expect(occurrencesInMonth(y, 2026, 3)).toEqual([]);
  });
});

describe("whenLabel", () => {
  it("formats each cycle", () => {
    expect(whenLabel(item({ cycle: "daily" }))).toBe("매일");
    expect(whenLabel(item({ cycle: "weekly", weekday: 1 }))).toBe("월요일");
    expect(whenLabel(item({ cycle: "monthly", day: 15 }))).toBe("15일");
    expect(whenLabel(item({ cycle: "quarterly", month: 1, day: 5 }))).toBe("1·4·7·10월 5일");
    expect(whenLabel(item({ cycle: "yearly", month: 12, day: 25 }))).toBe("12월 25일");
  });
});

describe("fixedInMonth", () => {
  it("sums occurrence amounts and skips inactive", () => {
    const items = [
      item({ id: "a", cycle: "monthly", amount: 50_000, day: 1 }),
      item({ id: "b", cycle: "monthly", amount: 20_000, day: 10, active: false }),
      item({ id: "c", cycle: "weekly", amount: 5_000, weekday: 1 }), // Sep 2026: 4 Mondays
    ];
    expect(fixedInMonth(items, 2026, 8)).toBe(50_000 + 5_000 * 4);
  });
});

describe("assignments", () => {
  it("filters items for a month", () => {
    const items = [
      item({ id: "a", cycle: "monthly", amount: 50_000 }),
      item({ id: "b", cycle: "monthly", amount: 20_000 }),
    ];
    const assignments = { "2026-09": ["a"] };
    expect(fixedInMonth(items, 2026, 8, assignments)).toBe(50_000);
    expect(fixedInMonth(items, 2026, 9, assignments)).toBe(0);
    expect(analyze(items, new Date(2026, 8, 15), new Date(2026, 8, 15), assignments).count).toBe(1);
  });
});

describe("nextOccurrence / daysUntil", () => {
  it("returns today when due today", () => {
    const now = new Date(2026, 8, 15); // Sep 15
    const next = nextOccurrence(item({ cycle: "monthly", day: 15 }), now);
    expect(next).not.toBeNull();
    expect(next!.getFullYear()).toBe(2026);
    expect(next!.getMonth()).toBe(8);
    expect(next!.getDate()).toBe(15);
    expect(daysUntil(next!, now)).toBe(0);
  });

  it("rolls to next month when day already passed", () => {
    const now = new Date(2026, 8, 20);
    const next = nextOccurrence(item({ cycle: "monthly", day: 10 }), now);
    expect(next).not.toBeNull();
    expect(next!.getMonth()).toBe(9);
    expect(next!.getDate()).toBe(10);
    expect(daysUntil(next!, now)).toBe(20);
  });

  it("finds next weekday for weekly", () => {
    const now = new Date(2026, 8, 15); // Tue
    const next = nextOccurrence(item({ cycle: "weekly", weekday: 1 }), now); // Mon
    expect(next).not.toBeNull();
    expect(next!.getDate()).toBe(21);
    expect(daysUntil(next!, now)).toBe(6);
  });

  it("returns null when no assigned month has a due date", () => {
    const now = new Date(2026, 8, 26);
    const it = item({ id: "a", cycle: "monthly", day: 15 });
    expect(nextOccurrence(it, now, { "2026-09": ["a"] })).toBeNull();
  });
});

describe("dueWithin", () => {
  it("counts dues in the window from now", () => {
    const now = new Date(2026, 8, 14); // Mon Sep 14
    const items = [
      item({ id: "a", cycle: "monthly", amount: 100_000, day: 15 }),
      item({ id: "b", cycle: "monthly", amount: 50_000, day: 30 }),
      item({ id: "c", cycle: "monthly", amount: 10_000, day: 10, active: false }),
    ];
    expect(dueWithin(items, 7, now)).toEqual({ total: 100_000, count: 1 });
    expect(dueWithin(items, 20, now)).toEqual({ total: 150_000, count: 2 });
  });
});

describe("analyze", () => {
  it("builds monthly analytics from active items", () => {
    const now = new Date(2026, 8, 15); // Sep 15
    const items = [
      item({ id: "a", cycle: "monthly", amount: 100_000, day: 10, category: "주거" }),
      item({ id: "b", cycle: "monthly", amount: 30_000, day: 20, category: "구독" }),
      item({ id: "c", cycle: "monthly", amount: 5_000, day: 1, category: "구독", active: false }),
    ];
    const a = analyze(items, now);
    expect(a.today).toBe(15);
    expect(a.daysInMonth).toBe(30);
    expect(a.count).toBe(2);
    expect(a.monthlyTotal).toBe(130_000);
    expect(a.yearlyTotal).toBe(1_560_000);
    expect(a.paidThisMonth).toBe(100_000);
    expect(a.remainingThisMonth).toBe(30_000);
    expect(a.byCategory).toEqual([
      { category: "주거", amount: 100_000 },
      { category: "구독", amount: 30_000 },
    ]);
    expect(a.upcoming.map((o) => o.item.id)).toEqual(["b"]);
  });

  it("treats past months as fully paid and future as fully remaining", () => {
    const asOf = new Date(2026, 8, 15); // Sep 15
    const items = [item({ id: "a", cycle: "monthly", amount: 100_000, day: 10 })];
    const past = analyze(items, new Date(2026, 7, 1), asOf); // Aug
    expect(past.today).toBe(32);
    expect(past.paidThisMonth).toBe(100_000);
    expect(past.remainingThisMonth).toBe(0);

    const future = analyze(items, new Date(2026, 9, 1), asOf); // Oct
    expect(future.today).toBe(0);
    expect(future.paidThisMonth).toBe(0);
    expect(future.remainingThisMonth).toBe(100_000);
  });
});

describe("upcomingInWindow", () => {
  it("ends on day 7 of the month after the viewed month", () => {
    const { end } = upcomingWindowBounds(2026, 9, new Date(2026, 8, 26));
    expect(end.getFullYear()).toBe(2026);
    expect(end.getMonth()).toBe(9);
    expect(end.getDate()).toBe(7);
  });

  it("does not fake TODAY when next month is unassigned", () => {
    const asOf = new Date(2026, 8, 26);
    const items = [
      item({ id: "tel", cycle: "monthly", amount: 80_950, day: 15 }),
      item({ id: "ai", cycle: "monthly", amount: 30_065, day: 9 }),
    ];
    const assignments = { "2026-09": ["tel", "ai"] };
    expect(upcomingInWindow(items, 2026, 9, asOf, assignments)).toEqual([]);
  });

  it("includes rest of viewed month and next-month week when assigned", () => {
    const asOf = new Date(2026, 8, 26);
    const items = [
      item({ id: "today", cycle: "monthly", amount: 10_000, day: 26 }),
      item({ id: "oct5", cycle: "monthly", amount: 20_000, day: 5 }),
      item({ id: "oct8", cycle: "monthly", amount: 30_000, day: 8 }),
      item({ id: "past", cycle: "monthly", amount: 40_000, day: 15 }),
    ];
    const assignments = {
      "2026-09": ["today", "past"],
      "2026-10": ["oct5", "oct8", "past"],
    };
    const rows = upcomingInWindow(items, 2026, 9, asOf, assignments);
    expect(rows.map((r) => r.item.id)).toEqual(["today", "oct5"]);
    expect(rows[0].dday).toBe(0);
    expect(rows[1].dday).toBe(9);
  });

  it("when viewing next month, includes that full month through its following week", () => {
    const asOf = new Date(2026, 8, 26); // still September today
    const items = [
      item({ id: "oct5", cycle: "monthly", day: 5 }),
      item({ id: "oct15", cycle: "monthly", day: 15 }),
      item({ id: "nov3", cycle: "monthly", day: 3 }),
      item({ id: "nov10", cycle: "monthly", day: 10 }),
    ];
    const rows = upcomingInWindow(items, 2026, 10, asOf, {
      "2026-10": ["oct5", "oct15"],
      "2026-11": ["nov3", "nov10"],
    });
    expect(rows.map((r) => r.item.id)).toEqual(["oct5", "oct15", "nov3"]);
  });

  it("excludes days after next-month day 7 from the viewed month", () => {
    const asOf = new Date(2026, 8, 1);
    const items = [item({ id: "oct7", cycle: "monthly", day: 7 }), item({ id: "oct8", cycle: "monthly", day: 8 })];
    const rows = upcomingInWindow(items, 2026, 9, asOf, {
      "2026-10": ["oct7", "oct8"],
    });
    expect(rows.map((r) => r.item.id)).toEqual(["oct7"]);
  });
});
