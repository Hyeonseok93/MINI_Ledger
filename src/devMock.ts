import type { FixedItem, Income } from "./schedule";
import { SAMPLE } from "./sampleData";

export function installDevMock() {
  if (window.ledger) return;

  let items: FixedItem[] = SAMPLE.map((s, i) => ({
    id: `mock-${i}`,
    name: s.name,
    amount: s.amount,
    cycle: s.cycle,
    day: s.day ?? 1,
    weekday: s.weekday ?? 1,
    month: s.month ?? 1,
    category: s.category,
    note: s.note ?? "",
    active: true,
  }));

  let income: Income = { base: 3_400_000, months: { "2026-07": 5_100_000, "2026-12": 4_200_000 } };

  window.ledger = {
    getAll: async () => [...items],
    upsert: async (draft) => {
      const prev = items.find((x) => x.id === draft.id);
      const row = {
        day: 1,
        weekday: 1,
        month: 1,
        active: true,
        note: "",
        category: "기타",
        cycle: "monthly",
        ...prev,
        ...draft,
      } as FixedItem;
      if (!row.id) row.id = `mock-${Date.now()}`;
      items = [...items.filter((x) => x.id !== row.id), row];
      return row;
    },
    remove: async (id) => {
      items = items.filter((x) => x.id !== id);
      return true;
    },
    getIncome: async () => income,
    setIncome: async (next) => {
      income = { base: next.base, months: { ...next.months } };
      return income;
    },
    getPaths: async () => ({ userData: "", storeDir: "browser-mock" }),
  };
}
