import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import * as store from "./store";

describe("electron store", () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "ledger-test-"));
    store.init(dir);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("upserts items and lists them", () => {
    const row = store.upsert({
      name: "통신비",
      amount: 80_950,
      cycle: "monthly",
      day: 15,
      category: "통신",
    });
    expect(row.id).toBeTruthy();
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].name).toBe("통신비");
  });

  it("saves a set from item ids and applies to a month", () => {
    const a = store.upsert({ name: "A", amount: 10_000, cycle: "monthly", day: 1, category: "기타" });
    const b = store.upsert({ name: "B", amount: 20_000, cycle: "monthly", day: 5, category: "기타" });
    const sets = store.saveSet("기본", [a.id, b.id]);
    expect(sets).toHaveLength(1);
    expect(sets[0].itemIds).toEqual([a.id, b.id]);

    const assigns = store.toggleSetMonth(sets[0].id, "2026-10");
    expect(assigns["2026-10"]).toEqual(expect.arrayContaining([a.id, b.id]));
  });

  it("keeps month applies when set membership changes", () => {
    const a = store.upsert({ name: "A", amount: 10_000, cycle: "monthly", day: 1, category: "기타" });
    const b = store.upsert({ name: "B", amount: 20_000, cycle: "monthly", day: 5, category: "기타" });
    const c = store.upsert({ name: "C", amount: 30_000, cycle: "monthly", day: 9, category: "기타" });
    const sets = store.saveSet("묶음", [a.id, b.id]);
    store.toggleSetMonth(sets[0].id, "2026-09");

    store.updateSet(sets[0].id, { itemIds: [a.id, c.id] });
    const assigns = store.getAssignments();
    expect(assigns["2026-09"]).toEqual(expect.arrayContaining([a.id, c.id]));
    expect(assigns["2026-09"]).not.toContain(b.id);
  });

  it("imports a snapshot over existing data", () => {
    store.upsert({ name: "old", amount: 1, cycle: "monthly", day: 1, category: "기타" });
    store.importSnapshot({
      version: 3,
      items: [
        {
          id: "x1",
          name: "새항목",
          amount: 1000,
          cycle: "monthly",
          day: 2,
          weekday: 1,
          month: 1,
          category: "구독",
          note: "",
        },
      ],
      assignments: { "2026-09": ["x1"] },
      sets: [],
      income: { base: 2_000_000, months: {} },
    });
    expect(store.getAll()).toHaveLength(1);
    expect(store.getAll()[0].name).toBe("새항목");
    expect(store.getIncome().base).toBe(2_000_000);
  });

  it("removeSet drops exclusive items but keeps drafts", () => {
    const a = store.upsert({ name: "A", amount: 10_000, cycle: "monthly", day: 1, category: "기타" });
    const b = store.upsert({ name: "B", amount: 20_000, cycle: "monthly", day: 5, category: "기타" });
    const draft = store.upsert({ name: "Draft", amount: 1, cycle: "monthly", day: 1, category: "기타" });
    const sets = store.saveSet("묶음", [a.id, b.id]);
    store.saveSet("다른", [b.id]);

    store.removeSet(sets[0].id);
    const ids = store.getAll().map((it) => it.id);
    expect(ids).toContain(b.id);
    expect(ids).toContain(draft.id);
    expect(ids).not.toContain(a.id);
  });
});
