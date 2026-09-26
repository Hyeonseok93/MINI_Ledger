import type { Assignments, FixedItem, Income, ItemSet } from "./schedule";
import type { LedgerSnapshot } from "./snapshot";

type FixedDraft = Partial<FixedItem> & {
  name: string;
  amount: number;
};

type SetPatch = { name?: string; itemIds?: string[] };

type LedgerApi = {
  getAll: () => Promise<FixedItem[]>;
  upsert: (item: FixedDraft) => Promise<FixedItem>;
  remove: (id: string) => Promise<boolean>;
  getAssignments: () => Promise<Assignments>;
  toggleSetMonth: (setId: string, monthKey: string) => Promise<Assignments>;
  getSets: () => Promise<ItemSet[]>;
  saveSet: (name: string, itemIds: string[]) => Promise<ItemSet[]>;
  removeSet: (id: string) => Promise<ItemSet[]>;
  updateSet: (id: string, patch: SetPatch) => Promise<ItemSet[]>;
  getIncome: () => Promise<Income>;
  setIncome: (income: Income) => Promise<Income>;
  getPaths: () => Promise<{ userData: string; storeDir: string }>;
  exportJson: () => Promise<{ ok: boolean; path?: string }>;
  importJson: () => Promise<{ ok: boolean; path?: string }>;
};

type WindowControlsApi = {
  minimize: () => void;
  toggleMaximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
};

declare global {
  interface Window {
    ledger: LedgerApi;
    windowControls?: WindowControlsApi;
  }
}

export {};
