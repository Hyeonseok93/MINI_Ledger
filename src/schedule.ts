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

export const monthKey = (year: number, month1: number) => `${year}-${String(month1).padStart(2, "0")}`;

export const incomeFor = (income: Income, year: number, month1: number) =>
  income.months[monthKey(year, month1)] ?? income.base;

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

export const fixedInMonth = (items: FixedItem[], year: number, month0: number) =>
  items
    .filter((it) => it.active)
    .reduce((sum, it) => sum + occurrencesInMonth(it, year, month0).length * it.amount, 0);

export function dueWithin(items: FixedItem[], days: number, now = new Date()) {
  let total = 0;
  let count = 0;
  const cache = new Map<string, number[]>();
  for (let i = 0; i < days; i++) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    for (const it of items) {
      if (!it.active) continue;
      const key = `${it.id}-${date.getFullYear()}-${date.getMonth()}`;
      if (!cache.has(key)) cache.set(key, occurrencesInMonth(it, date.getFullYear(), date.getMonth()));
      if (cache.get(key)!.includes(date.getDate())) {
        total += it.amount;
        count += 1;
      }
    }
  }
  return { total, count };
}

export function nextOccurrence(it: FixedItem, now = new Date()): Date {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  for (let i = 0; i <= 12; i++) {
    const base = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const days = occurrencesInMonth(it, base.getFullYear(), base.getMonth());
    const hit = i === 0 ? days.find((d) => d >= today.getDate()) : days[0];
    if (hit !== undefined) return new Date(base.getFullYear(), base.getMonth(), hit);
  }
  return today;
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
  yearlyTotal: number;
  paidThisMonth: number;
  remainingThisMonth: number;
  byCategory: { category: string; amount: number }[];
  occurrences: Occurrence[];
  upcoming: Occurrence[];
};

export function analyze(items: FixedItem[], now = new Date()): Analytics {
  const active = items.filter((it) => it.active);
  const year = now.getFullYear();
  const month0 = now.getMonth();
  const today = now.getDate();

  const occurrences: Occurrence[] = active.flatMap((item) =>
    occurrencesInMonth(item, year, month0).map((day) => ({ item, day }))
  );

  const byCat = new Map<string, number>();
  for (const it of active) byCat.set(it.category, (byCat.get(it.category) ?? 0) + perMonth(it));

  const upcoming = active
    .map((item) => ({ item, day: occurrencesInMonth(item, year, month0).find((d) => d >= today) }))
    .filter((o): o is Occurrence => o.day !== undefined)
    .sort((a, b) => a.day - b.day || b.item.amount - a.item.amount);

  return {
    today,
    daysInMonth: daysInMonth(year, month0),
    count: active.length,
    monthlyTotal: active.reduce((s, it) => s + perMonth(it), 0),
    yearlyTotal: active.reduce((s, it) => s + perYear(it), 0),
    paidThisMonth: occurrences.filter((o) => o.day < today).reduce((s, o) => s + o.item.amount, 0),
    remainingThisMonth: occurrences.filter((o) => o.day >= today).reduce((s, o) => s + o.item.amount, 0),
    byCategory: [...byCat]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    occurrences,
    upcoming,
  };
}
