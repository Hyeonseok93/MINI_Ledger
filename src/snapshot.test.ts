import { describe, expect, it } from "vitest";
import { isLedgerSnapshot } from "./snapshot";

describe("isLedgerSnapshot", () => {
  it("accepts a minimal valid document", () => {
    expect(
      isLedgerSnapshot({
        version: 3,
        items: [],
        assignments: {},
        sets: [],
        income: { base: 0, months: {} },
      })
    ).toBe(true);
  });

  it("rejects missing items", () => {
    expect(isLedgerSnapshot({ version: 3 })).toBe(false);
    expect(isLedgerSnapshot(null)).toBe(false);
    expect(isLedgerSnapshot([])).toBe(false);
  });
});
