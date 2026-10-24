import type { Cycle } from "./schedule";

export type Seed = {
  name: string;
  amount: number;
  cycle: Cycle;
  category: string;
  day?: number;
  weekday?: number;
  month?: number;
  note?: string;
};

export const SAMPLE: Seed[] = [
  { name: "월세", amount: 650000, cycle: "monthly", day: 1, category: "주거" },
  { name: "관리비", amount: 120000, cycle: "monthly", day: 10, category: "주거" },
  { name: "휴대폰", amount: 69000, cycle: "monthly", day: 15, category: "통신" },
  { name: "인터넷", amount: 33000, cycle: "monthly", day: 15, category: "통신" },
  { name: "넷플릭스", amount: 17000, cycle: "monthly", day: 7, category: "구독" },
  { name: "Claude Pro", amount: 29000, cycle: "monthly", day: 21, category: "구독" },
  { name: "실손보험", amount: 48000, cycle: "monthly", day: 25, category: "보험" },
  { name: "출근 커피", amount: 2500, cycle: "daily", category: "기타" },
  { name: "필라테스", amount: 30000, cycle: "weekly", weekday: 3, category: "운동" },
  { name: "자동차보험", amount: 210000, cycle: "quarterly", month: 3, day: 5, category: "차량" },
  { name: "도메인·호스팅", amount: 180000, cycle: "yearly", month: 9, day: 12, category: "구독", note: "연 1회" },
  { name: "적금", amount: 300000, cycle: "monthly", day: 25, category: "저축" },
  { name: "주택청약", amount: 100000, cycle: "monthly", day: 25, category: "청약" },
  { name: "부모님 용돈", amount: 200000, cycle: "monthly", day: 5, category: "가족 용돈" },
];
