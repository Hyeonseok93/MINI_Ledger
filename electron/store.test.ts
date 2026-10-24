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
    expect(store.getSets()).toHaveLength(1);
    expect(store.getSets()[0].name).toBe("기본");
    expect(store.getSets()[0].itemIds).toEqual(["x1"]);
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

  describe("safe saving", () => {
    const file = () => path.join(dir, "store", "ledger.json");
    const bak = () => `${file()}.bak`;
    const names = (raw: string) => (JSON.parse(raw).items as { name: string }[]).map((it) => it.name);
    const corruptCopies = () => fs.readdirSync(path.join(dir, "store")).filter((f) => f.startsWith("ledger.corrupt-"));

    it("keeps the previous version in .bak and leaves no temp file", () => {
      store.upsert({ name: "A", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      store.upsert({ name: "B", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      expect(names(fs.readFileSync(file(), "utf8"))).toEqual(["A", "B"]);
      expect(names(fs.readFileSync(bak(), "utf8"))).toEqual(["A"]);
      expect(fs.existsSync(`${file()}.tmp`)).toBe(false);
    });

    it("restores from .bak at startup when ledger.json is unreadable", () => {
      store.upsert({ name: "A", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      store.upsert({ name: "B", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      fs.writeFileSync(file(), "{ broken", "utf8");

      store.init(dir);
      expect(store.getAll().map((it) => it.name)).toEqual(["A"]);
      expect(corruptCopies()).toHaveLength(1);
    });

    it("blocks every write when ledger.json is unreadable and there is no backup", () => {
      store.upsert({ name: "A", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      fs.rmSync(bak());
      fs.writeFileSync(file(), "{ broken", "utf8");

      store.init(dir);
      expect(() => store.getAll()).toThrow(/Import/);
      expect(() => store.upsert({ name: "B", amount: 1, cycle: "monthly", day: 1, category: "기타" })).toThrow();
      expect(fs.readFileSync(file(), "utf8")).toBe("{ broken");
      expect(corruptCopies()).toHaveLength(1);
    });

    it("blocks writes when ledger.json breaks mid-session", () => {
      store.upsert({ name: "A", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      const before = fs.readFileSync(bak(), "utf8");
      fs.writeFileSync(file(), "[]", "utf8");

      expect(() => store.upsert({ name: "B", amount: 1, cycle: "monthly", day: 1, category: "기타" })).toThrow();
      expect(fs.readFileSync(file(), "utf8")).toBe("[]");
      expect(fs.readFileSync(bak(), "utf8")).toBe(before);
    });

    it("import recovers a blocked store without backing up the broken file", () => {
      store.upsert({ name: "A", amount: 1, cycle: "monthly", day: 1, category: "기타" });
      const before = fs.readFileSync(bak(), "utf8");
      fs.writeFileSync(file(), "{ broken", "utf8");
      expect(() => store.getAll()).toThrow();

      store.importSnapshot({ version: 3, items: [], assignments: {}, sets: [], income: { base: 0, months: {} } });
      expect(store.getAll()).toEqual([]);
      expect(fs.readFileSync(bak(), "utf8")).toBe(before);
    });
  });
});
