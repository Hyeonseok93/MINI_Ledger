import type { Assignments, FixedItem, Income, ItemSet } from "./schedule";
import { monthKey } from "./schedule";
import { INCOME_START } from "./format";
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

  let income: Income = { base: 3_400_000, months: { "2026-12": 4_200_000 } };
  let sets: ItemSet[] = [];

  const seedKeys = () => {
    const keys: string[] = [];
    const now = new Date();
    let y = INCOME_START.year;
    let m = INCOME_START.month;
    while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
      keys.push(monthKey(y, m));
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
      if (keys.length > 240) break;
    }
    return keys;
  };

  let assignments: Assignments = Object.fromEntries(seedKeys().map((k) => [k, items.map((it) => it.id)]));
  const cloneAssign = () => Object.fromEntries(Object.entries(assignments).map(([k, v]) => [k, [...v]]));
  const cloneSets = () => sets.map((s) => ({ ...s, itemIds: [...s.itemIds] }));

  function scrubAssign(id: string) {
    for (const key of Object.keys(assignments)) {
      assignments[key] = assignments[key].filter((x) => x !== id);
      if (!assignments[key].length) delete assignments[key];
    }
  }

  function pruneOrphans() {
    if (!sets.length) return;
    const used = new Set(sets.flatMap((s) => s.itemIds));
    const drop = items.filter((it) => !used.has(it.id)).map((it) => it.id);
    if (!drop.length) return;
    items = items.filter((it) => used.has(it.id));
    for (const id of drop) scrubAssign(id);
  }

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
      for (const key of Object.keys(assignments)) {
        assignments[key] = assignments[key].filter((x) => x !== id);
        if (!assignments[key].length) delete assignments[key];
      }
      sets = sets.map((s) => ({ ...s, itemIds: s.itemIds.filter((x) => x !== id) }));
      return true;
    },
    getAssignments: async () => cloneAssign(),
    toggleAssign: async (itemId, key) => {
      const set = new Set(assignments[key] ?? []);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      if (set.size) assignments[key] = [...set];
      else delete assignments[key];
      return cloneAssign();
    },
    assignToMonths: async (itemId, monthKeys) => {
      for (const key of monthKeys) {
        const set = new Set(assignments[key] ?? []);
        set.add(itemId);
        assignments[key] = [...set];
      }
      return cloneAssign();
    },
    toggleSetMonth: async (setId, key) => {
      const found = sets.find((s) => s.id === setId);
      if (!found) throw new Error("set not found");
      const ids = found.itemIds.filter((id) => items.some((it) => it.id === id));
      const current = new Set(assignments[key] ?? []);
      const allOn = ids.every((id) => current.has(id));
      if (allOn) ids.forEach((id) => current.delete(id));
      else ids.forEach((id) => current.add(id));
      if (current.size) assignments[key] = [...current];
      else delete assignments[key];
      return cloneAssign();
    },
    getSets: async () => cloneSets(),
    saveSet: async (name, itemIds) => {
      const label = name.trim();
      if (!label) throw new Error("name required");
      const known = new Set(items.map((it) => it.id));
      const ids = [...new Set((itemIds ?? []).filter((id) => known.has(id)))];
      if (!ids.length) throw new Error("no items");
      if (sets.some((s) => s.name.trim().toLowerCase() === label.toLowerCase())) throw new Error("duplicate name");
      sets = [
        ...sets,
        { id: `set-${Date.now()}`, name: label, itemIds: ids, createdAt: new Date().toISOString() },
      ];
      return cloneSets();
    },
    removeSet: async (id) => {
      sets = sets.filter((s) => s.id !== id);
      pruneOrphans();
      return cloneSets();
    },
    updateSet: async (id, patch) => {
      const idx = sets.findIndex((s) => s.id === id);
      if (idx < 0) throw new Error("set not found");
      const next = { ...sets[idx] };
      if (patch.name !== undefined) {
        const label = patch.name.trim();
        if (!label) throw new Error("name required");
        if (sets.some((s) => s.id !== id && s.name.trim().toLowerCase() === label.toLowerCase())) {
          throw new Error("duplicate name");
        }
        next.name = label;
      }
      if (Array.isArray(patch.itemIds) || patch.refreshItems) {
        const oldIds = [...next.itemIds];
        if (Array.isArray(patch.itemIds)) {
          const known = new Set(items.map((it) => it.id));
          next.itemIds = [...new Set(patch.itemIds.filter((x) => known.has(x)))];
        } else {
          next.itemIds = items.map((it) => it.id);
        }
        if (!next.itemIds.length) throw new Error("no items");
        sets = sets.map((s, i) => (i === idx ? next : s));

        const applied = Object.entries(assignments)
          .filter(([, list]) => oldIds.length > 0 && oldIds.every((id) => list.includes(id)))
          .map(([key]) => key);
        const removed = oldIds.filter((id) => !next.itemIds.includes(id));
        for (const key of applied) {
          const bucket = new Set(assignments[key] ?? []);
          for (const itemId of next.itemIds) bucket.add(itemId);
          for (const itemId of removed) {
            if (!sets.some((s) => s.itemIds.includes(itemId))) bucket.delete(itemId);
          }
          if (bucket.size) assignments[key] = [...bucket];
          else delete assignments[key];
        }
      } else {
        sets = sets.map((s, i) => (i === idx ? next : s));
      }
      pruneOrphans();
      return cloneSets();
    },
    getIncome: async () => income,
    setIncome: async (next) => {
      income = { base: next.base, months: { ...next.months } };
      return income;
    },
    getPaths: async () => ({ userData: "", storeDir: "browser-mock" }),
    exportJson: async () => {
      const snap = { version: 3, items, assignments, sets, income };
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
      const raw = JSON.parse(await file.text()) as {
        items?: FixedItem[];
        assignments?: Assignments;
        sets?: ItemSet[];
        income?: Income;
      };
      if (!raw || !Array.isArray(raw.items)) throw new Error("invalid backup");
      items = raw.items;
      assignments = raw.assignments && typeof raw.assignments === "object" ? raw.assignments : {};
      sets = Array.isArray(raw.sets) ? raw.sets : [];
      income = raw.income ?? { base: 0, months: {} };
      return { ok: true };
    },
  };
}
