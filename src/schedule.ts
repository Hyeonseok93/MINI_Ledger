export type Cycle = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";

export type FixedItem = {
  id: string;
  name: string;
  amount: number;
  cycle: Cycle;
  day: number;
  weekday: number;
  month: number;
  category: string;
  note: string;
  active: boolean;
};

export type Income = {
  base: number;
  months: Record<string, number>;
};

/** monthKey ("2026-09") → item ids applied that month */
export type Assignments = Record<string, string[]>;

export type ItemSet = {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: string;
};

export const monthKey = (year: number, month1: number) => `${year}-${String(month1).padStart(2, "0")}`;

export const incomeFor = (income: Income, year: number, month1: number) =>
  income.months[monthKey(year, month1)] ?? income.base;

export function isAssigned(assignments: Assignments, itemId: string, year: number, month1: number) {
  return (assignments[monthKey(year, month1)] ?? []).includes(itemId);
}

/** undefined assignments = legacy (all active). empty object = nothing assigned. */
export function itemsForMonth(
  items: FixedItem[],
  assignments: Assignments | undefined,
  year: number,
  month1: number
) {
  if (assignments === undefined) return items.filter((it) => it.active);
  const ids = new Set(assignments[monthKey(year, month1)] ?? []);
  return items.filter((it) => it.active && ids.has(it.id));
}

export const CYCLES: { value: Cycle; label: string }[] = [
  { value: "daily", label: "매일" },
  { value: "weekly", label: "매주" },
  { value: "monthly", label: "매월" },
  { value: "quarterly", label: "분기" },
  { value: "yearly", label: "연간" },
];

export const CYCLE_LABEL: Record<Cycle, string> = Object.fromEntries(
  CYCLES.map((c) => [c.value, c.label])
) as Record<Cycle, string>;

export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

const PER_YEAR: Record<Cycle, number> = {
  daily: 365,
  weekly: 52,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

export const perMonth = (it: FixedItem) => (it.amount * PER_YEAR[it.cycle]) / 12;
export const perYear = (it: FixedItem) => it.amount * PER_YEAR[it.cycle];

export function quarterMonths(anchor: number) {
  const first = ((anchor - 1) % 3) + 1;
  return [first, first + 3, first + 6, first + 9];
}

export function daysInMonth(year: number, month0: number) {
  return new Date(year, month0 + 1, 0).getDate();
}

export function occurrencesInMonth(it: FixedItem, year: number, month0: number): number[] {
  const dim = daysInMonth(year, month0);
  const month1 = month0 + 1;
  const clamp = (d: number) => Math.min(d, dim);

  switch (it.cycle) {
    case "daily":
      return Array.from({ length: dim }, (_, i) => i + 1);
    case "weekly": {
      const first = ((it.weekday - new Date(year, month0, 1).getDay() + 7) % 7) + 1;
      const out: number[] = [];
      for (let d = first; d <= dim; d += 7) out.push(d);
      return out;
    }
    case "monthly":
      return [clamp(it.day)];
    case "quarterly":
      return quarterMonths(it.month).includes(month1) ? [clamp(it.day)] : [];
    case "yearly":
      return it.month === month1 ? [clamp(it.day)] : [];
  }
}

export function whenLabel(it: FixedItem) {
  switch (it.cycle) {
    case "daily":
      return "매일";
    case "weekly":
      return `${WEEKDAY_KO[it.weekday]}요일`;
    case "monthly":
      return `${it.day}일`;
    case "quarterly":
      return `${quarterMonths(it.month).join("·")}월 ${it.day}일`;
    case "yearly":
      return `${it.month}월 ${it.day}일`;
  }
}

export const fixedInMonth = (
  items: FixedItem[],
  year: number,
  month0: number,
  assignments?: Assignments
) =>
  itemsForMonth(items, assignments, year, month0 + 1).reduce(
    (sum, it) => sum + occurrencesInMonth(it, year, month0).length * it.amount,
    0
  );

export function dueWithin(
  items: FixedItem[],
  days: number,
  now = new Date(),
  assignments?: Assignments
) {
  let total = 0;
  let count = 0;
  const cache = new Map<string, number[]>();
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const y = date.getFullYear();
    const m0 = date.getMonth();
    const m1 = m0 + 1;
    for (const it of itemsForMonth(items, assignments, y, m1)) {
      const key = `${it.id}-${y}-${m0}`;
      if (!cache.has(key)) cache.set(key, occurrencesInMonth(it, y, m0));
      if (cache.get(key)!.includes(date.getDate())) {
        total += it.amount;
        count += 1;
      }
    }
  }
  return { total, count };
}

export function nextOccurrence(it: FixedItem, now = new Date(), assignments?: Assignments): Date | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i <= 24; i++) {
    const base = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const y = base.getFullYear();
    const m0 = base.getMonth();
    if (assignments && !isAssigned(assignments, it.id, y, m0 + 1)) continue;
    const days = occurrencesInMonth(it, y, m0);
    const hit = i === 0 ? days.find((d) => d >= today.getDate()) : days[0];
    if (hit !== undefined) return new Date(y, m0, hit);
  }
  return null;
}

/** Bounds for Upcoming relative to a viewed month: that month (from asOf if current) through day 7 of the next month. */
export function upcomingWindowBounds(viewYear: number, viewMonth1: number, asOf = new Date()) {
  const asOfDay = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate());
  const monthStart = new Date(viewYear, viewMonth1 - 1, 1);
  const monthEnd = new Date(viewYear, viewMonth1, 0);
  const end = new Date(viewYear, viewMonth1, 7);

  if (asOfDay > monthEnd) return { start: new Date(end.getTime() + 86_400_000), end };

  const start = asOfDay < monthStart ? monthStart : asOfDay;
  return { start, end };
}

export type UpcomingEntry = { item: FixedItem; date: Date; dday: number };

/** Dues in the viewed month (remaining if current) plus the first week of the following month. */
export function upcomingInWindow(
  items: FixedItem[],
  viewYear: number,
  viewMonth1: number,
  asOf = new Date(),
  assignments?: Assignments
): UpcomingEntry[] {
  const { start, end } = upcomingWindowBounds(viewYear, viewMonth1, asOf);
  if (start > end) return [];

  const out: UpcomingEntry[] = [];
  const cache = new Map<string, number[]>();

  for (let t = start.getTime(); t <= end.getTime(); t += 86_400_000) {
    const date = new Date(t);
    const y = date.getFullYear();
    const m0 = date.getMonth();
    const m1 = m0 + 1;
    const day = date.getDate();
    for (const it of itemsForMonth(items, assignments, y, m1)) {
      const key = `${it.id}-${y}-${m0}`;
      if (!cache.has(key)) cache.set(key, occurrencesInMonth(it, y, m0));
      if (!cache.get(key)!.includes(day)) continue;
      out.push({ item: it, date, dday: daysUntil(date, asOf) });
    }
  }

  return out.sort((a, b) => a.dday - b.dday || b.item.amount - a.item.amount);
}

export function daysUntil(date: Date, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((date.getTime() - today.getTime()) / 86_400_000);
}

export type Occurrence = { item: FixedItem; day: number };

export type Analytics = {
  today: number;
  daysInMonth: number;
  count: number;
  monthlyTotal: number;
  paidThisMonth: number;
  remainingThisMonth: number;
  occurrences: Occurrence[];
};

/** `view` = any day in the month to analyze. `asOf` = real "today" for paid/remaining. */
export function analyze(
  items: FixedItem[],
  view = new Date(),
  asOf = view,
  assignments?: Assignments
): Analytics {
  const year = view.getFullYear();
  const month0 = view.getMonth();
  const dim = daysInMonth(year, month0);
  const monthItems = itemsForMonth(items, assignments, year, month0 + 1);

  const sameMonth = year === asOf.getFullYear() && month0 === asOf.getMonth();
  const isPast = new Date(year, month0, 1) < new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const today = sameMonth ? asOf.getDate() : isPast ? dim + 1 : 0;

  const occurrences: Occurrence[] = monthItems.flatMap((item) =>
    occurrencesInMonth(item, year, month0).map((day) => ({ item, day }))
  );

  const monthlyTotal = occurrences.reduce((s, o) => s + o.item.amount, 0);

  return {
    today,
    daysInMonth: dim,
    count: monthItems.length,
    monthlyTotal,
    paidThisMonth: occurrences.filter((o) => o.day < today).reduce((s, o) => s + o.item.amount, 0),
    remainingThisMonth: occurrences.filter((o) => o.day >= today).reduce((s, o) => s + o.item.amount, 0),
    occurrences,
  };
}
