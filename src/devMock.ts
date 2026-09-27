import type { Assignments, FixedItem, Income, ItemSet } from "./schedule";
import { INCOME_START } from "./format";
import { SAMPLE } from "./sampleData";
import { isLedgerSnapshot, type LedgerSnapshot } from "./snapshot";
import {
  dropReleasedOrphans,
  migrateSnapshot,
  monthKeysThrough,
  normalizeIncome,
  normalizeItem,
  reapplySetMonths,
  scrubAssignments,
  setNameTaken,
  toggleSetMonthIds,
} from "./ledgerData";

export function installDevMock() {
  if (window.ledger) return;

  let items: FixedItem[] = SAMPLE.map((s, i) =>
    normalizeItem({
      id: `mock-${i}`,
      name: s.name,
      amount: s.amount,
      cycle: s.cycle,
      day: s.day ?? 1,
      weekday: s.weekday ?? 1,
      month: s.month ?? 1,
      category: s.category,
      note: s.note ?? "",
    })
  );

  let income: Income = normalizeIncome({ base: 3_400_000, months: { "2026-12": 4_200_000 } });
  let sets: ItemSet[] = [];
  let assignments: Assignments = Object.fromEntries(
    monthKeysThrough(new Date(), INCOME_START).map((k) => [k, items.map((it) => it.id)])
  );

  const state = () => ({ items, sets, assignments });
  const cloneAssign = () => Object.fromEntries(Object.entries(assignments).map(([k, v]) => [k, [...v]]));
  const cloneSets = () => sets.map((s) => ({ ...s, itemIds: [...s.itemIds] }));

  window.ledger = {
    getAll: async () => items.map(normalizeItem),
    upsert: async (draft) => {
      if (draft.id && !items.some((x) => x.id === draft.id)) throw new Error("not found");
      const prev = items.find((x) => x.id === draft.id);
      const row = normalizeItem({
        id: draft.id || prev?.id || `mock-${Date.now()}`,
        name: draft.name ?? prev?.name ?? "",
        amount: draft.amount ?? prev?.amount ?? 0,
        cycle: draft.cycle ?? prev?.cycle ?? "monthly",
        day: draft.day ?? prev?.day ?? 1,
        weekday: draft.weekday ?? prev?.weekday ?? 1,
        month: draft.month ?? prev?.month ?? 1,
        category: draft.category ?? prev?.category ?? "기타",
        note: draft.note ?? prev?.note ?? "",
      });
      items = [...items.filter((x) => x.id !== row.id), row];
      return row;
    },
    remove: async (id) => {
      items = items.filter((x) => x.id !== id);
      scrubAssignments(assignments, id);
      sets = sets.map((s) => ({ ...s, itemIds: s.itemIds.filter((x) => x !== id) }));
      return true;
    },
    getAssignments: async () => cloneAssign(),
    toggleSetMonth: async (setId, key) => {
      const found = sets.find((s) => s.id === setId);
      if (!found) throw new Error("set not found");
      const ids = found.itemIds.filter((id) => items.some((it) => it.id === id));
      if (!ids.length) throw new Error("empty set");
      toggleSetMonthIds(assignments, sets, setId, key, ids);
      return cloneAssign();
    },
    getSets: async () => cloneSets(),
    saveSet: async (name, itemIds) => {
      const label = name.trim();
      if (!label) throw new Error("name required");
      if (setNameTaken(sets, label)) throw new Error("duplicate name");
      const known = new Set(items.map((it) => it.id));
      const ids = [...new Set((itemIds ?? []).filter((id) => known.has(id)))];
      if (!ids.length) throw new Error("no items");
      sets = [
        ...sets,
        { id: `set-${Date.now()}`, name: label, itemIds: ids, createdAt: new Date().toISOString() },
      ];
      return cloneSets();
    },
    removeSet: async (id) => {
      const victim = sets.find((s) => s.id === id);
      const released = [...(victim?.itemIds ?? [])];
      sets = sets.filter((s) => s.id !== id);
      const data = state();
      dropReleasedOrphans(data, released);
      items = data.items;
      return cloneSets();
    },
    updateSet: async (id, patch) => {
      const idx = sets.findIndex((s) => s.id === id);
      if (idx < 0) throw new Error("set not found");
      const next = { ...sets[idx] };
      if (patch.name !== undefined) {
        const label = patch.name.trim();
        if (!label) throw new Error("name required");
        if (setNameTaken(sets, label, id)) throw new Error("duplicate name");
        next.name = label;
      }
      if (Array.isArray(patch.itemIds)) {
        const known = new Set(items.map((it) => it.id));
        const oldIds = [...next.itemIds];
        next.itemIds = [...new Set(patch.itemIds.filter((x) => known.has(x)))];
        if (!next.itemIds.length) throw new Error("no items");
        sets = sets.map((s, i) => (i === idx ? next : s));
        const data = state();
        reapplySetMonths(data, oldIds, next.itemIds);
        dropReleasedOrphans(
          data,
          oldIds.filter((itemId) => !next.itemIds.includes(itemId))
        );
        items = data.items;
      } else {
        sets = sets.map((s, i) => (i === idx ? next : s));
      }
      return cloneSets();
    },
    getIncome: async () => income,
    setIncome: async (next) => {
      income = normalizeIncome(next);
      return income;
    },
    getPaths: async () => ({ userData: "", storeDir: "browser-mock" }),
    exportJson: async () => {
      const snap: LedgerSnapshot = { version: 3, items, assignments, sets, income };
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ledger-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      return { ok: true };
    },
    importJson: async () => {
      const file = await new Promise<File | null>((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "application/json,.json";
        input.onchange = () => resolve(input.files?.[0] ?? null);
        input.click();
      });
      if (!file) return { ok: false };
      if (!window.confirm("현재 장부를 선택한 파일로 바꿀까요?\n항목·세트·월 적용·수입이 모두 덮어씌워집니다.")) {
        return { ok: false };
      }
      const raw: unknown = JSON.parse(await file.text());
      if (!isLedgerSnapshot(raw)) throw new Error("invalid backup");
      const data = migrateSnapshot(raw);
      items = data.items.map(normalizeItem);
      assignments = data.assignments;
      sets = data.sets;
      income = data.income;
      return { ok: true };
    },
  };
}
