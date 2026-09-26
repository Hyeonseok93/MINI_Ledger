export const CATEGORIES = [
  "주거",
  "생활",
  "공과금",
  "통신",
  "구독",
  "소프트웨어",
  "보험",
  "교통",
  "차량",
  "대출·이자",
  "저축·투자",
  "세금",
  "교육",
  "건강·의료",
  "운동·취미",
  "반려동물",
  "육아",
  "가족·용돈",
  "회비·경조사",
  "기부",
  "기타",
];

export const SHADES = [1, 0.7, 0.5, 0.36, 0.26, 0.18, 0.12];
export const WEEKDAYS_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
export const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export const NOTE_MAX = 30;
export const INCOME_START = { year: 2026, month: 10 };

export const num = (n: number) => new Intl.NumberFormat("ko-KR").format(Math.round(n));
export const pad2 = (n: number) => String(n).padStart(2, "0");
export const won = (n: number) => (Math.round(n) < 0 ? `− ₩${num(-n)}` : `₩${num(n)}`);
export const man = (n: number) => (n === 0 ? "0" : `${num(n / 10_000)}만`);
export const parseWon = (s: string) => Number(s.replace(/[^\d]/g, "")) || 0;
