import type { Cycle } from "./schedule";

export const emptyForm = {
  name: "",
  amount: "",
  cycle: "monthly" as Cycle,
  day: "1",
  weekday: "1",
  month: "1",
  category: "구독",
  note: "",
};

export type Form = typeof emptyForm;
