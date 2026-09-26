import type { Assignments, FixedItem, Income, ItemSet } from "./schedule";

type FixedDraft = Partial<FixedItem> & {
  name: string;
  amount: number;
};

type LedgerApi = {
  getAll: () => Promise<FixedItem[]>;
  upsert: (item: FixedDraft) => Promise<FixedItem>;
  remove: (id: string) => Promise<boolean>;
  getAssignments: () => Promise<Assignments>;
  toggleAssign: (itemId: string, monthKey: string) => Promise<Assignments>;
  assignToMonths: (itemId: string, monthKeys: string[]) => Promise<Assignments>;
  toggleSetMonth: (setId: string, monthKey: string) => Promise<Assignments>;
  getSets: () => Promise<ItemSet[]>;
  saveSet: (name: string, itemIds: string[]) => Promise<ItemSet[]>;
  removeSet: (id: string) => Promise<ItemSet[]>;
  updateSet: (id: string, patch: { name?: string; itemIds?: string[]; refreshItems?: boolean }) => Promise<ItemSet[]>;
  getIncome: () => Promise<Income>;
  setIncome: (income: Income) => Promise<Income>;
  getPaths: () => Promise<{ userData: string; storeDir: string }>;
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
