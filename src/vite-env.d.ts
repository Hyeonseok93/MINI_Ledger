import type { FixedItem, Income } from "./schedule";

type FixedDraft = Partial<FixedItem> & {
  name: string;
  amount: number;
};

type LedgerApi = {
  getAll: () => Promise<FixedItem[]>;
  upsert: (item: FixedDraft) => Promise<FixedItem>;
  remove: (id: string) => Promise<boolean>;
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
