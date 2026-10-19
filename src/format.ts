export const CATEGORIES = [
  "주거",
  "생활",
  "식비",
  "공과금",
  "통신",
  "구독",
  "쇼핑",
  "보험",
  "교통",
  "차량",
  "대출",
  "저축",
  "투자",
  "이체",
  "송금",
  "용돈",
  "세금",
  "교육",
  "건강·의료",
  "운동",
  "취미",
  "반려동물",
  "육아",
  "회비",
  "경조사",
  "기부",
  "헌금",
  "기타",
];

export const SHADES = [1, 0.7, 0.5, 0.36, 0.26, 0.18, 0.12];
export const WEEKDAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export const NOTE_MAX = 30;
export const INCOME_START = { year: 2026, month: 10 };

export type YearMonth = { year: number; month: number };

export const num = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const won = (n: number) => (Math.round(n) < 0 ? `− ₩${num(-n)}` : `₩${num(n)}`);
export const man = (n: number) => (n === 0 ? "0" : `${num(n / 10_000)}만`);
export const parseWon = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;

export const ymKey = (ym: YearMonth) => ym.year * 12 + ym.month;
export const ymLabel = (ym: YearMonth) => `${ym.year}.${pad2(ym.month)}`;

export function clampYearMonth(ym: YearMonth): YearMonth {
  return ymKey(ym) < ymKey(INCOME_START) ? { ...INCOME_START } : ym;
}

export function yearMonthFromDate(d: Date): YearMonth {
  return clampYearMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
}

export function shiftYearMonth(ym: YearMonth, delta: number): YearMonth {
  const d = new Date(ym.year, ym.month - 1 + delta, 1);
  return clampYearMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
}

export const canShiftPrev = (ym: YearMonth) => ymKey(ym) > ymKey(INCOME_START);

/** Months available for a ledger year (respects INCOME_START). */
export function monthsInYear(year: number): number[] {
  const first = year === INCOME_START.year ? INCOME_START.month : 1;
  return MONTHS.filter((m) => m >= first);
}
