import { dueWithin, type Analytics, type Assignments, type FixedItem } from "../schedule";
import { man, num, type YearMonth } from "../format";

export function RhythmInsight({
  stats,
  items,
  assignments,
  cursor,
  asOf,
  isCurrent,
}: {
  stats: Analytics;
  items: FixedItem[];
  assignments: Assignments;
  cursor: YearMonth;
  asOf: Date;
  isCurrent: boolean;
}) {
  const lead = (new Date(cursor.year, cursor.month - 1, 1).getDay() + 6) % 7;
  const weekOf = (d: number) => Math.floor((d - 1 + lead) / 7);
  const weekCount = weekOf(stats.daysInMonth) + 1;
  const thisWeek = isCurrent ? weekOf(stats.today) : -1;

  const weeks = Array.from({ length: weekCount }, (_, w) => {
    const from = Math.max(1, w * 7 - lead + 1);
    const to = Math.min(stats.daysInMonth, (w + 1) * 7 - lead);
    const total = stats.occurrences.filter((o) => weekOf(o.day) === w).reduce((s, o) => s + o.item.amount, 0);
    return { w, from, to, total };
  });
  const maxWeek = Math.max(1, ...weeks.map((w) => w.total));

  const byDay = new Map<number, number>();
  for (const o of stats.occurrences) byDay.set(o.day, (byDay.get(o.day) ?? 0) + o.item.amount);
  const peak = [...byDay].sort((a, b) => b[1] - a[1])[0];
  const next7 = isCurrent ? dueWithin(items, 7, asOf, assignments) : null;
  const remainingCount = stats.occurrences.filter((o) => o.day >= stats.today).length;
  const monthTotal = stats.occurrences.reduce((s, o) => s + o.item.amount, 0);

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Payment rhythm · this month</span>
        <span className="mono-label dim">{weekCount} weeks</span>
      </div>
      <div className="rhythm">
        <dl className="rhythm-stats">
          <div>
            <dt>{isCurrent ? "다음 7일" : "이 달 합계"}</dt>
            <dd>₩{num(isCurrent ? next7!.total : monthTotal)}</dd>
            <small>{isCurrent ? `${next7!.count}건` : `${stats.occurrences.length}건`}</small>
          </div>
          <div>
            <dt>{isCurrent ? "이번 달 남은 결제" : stats.today > stats.daysInMonth ? "남은 결제" : "예정 결제"}</dt>
            <dd className="accent">₩{num(stats.remainingThisMonth)}</dd>
            <small>{remainingCount}건</small>
          </div>
          <div>
            <dt>결제 집중일</dt>
            <dd>{peak ? `${peak[0]}일` : "—"}</dd>
            <small>{peak ? `₩${num(peak[1])}` : ""}</small>
          </div>
        </dl>
        <div className="weeks">
          {weeks.map((w) => (
            <div
              key={w.w}
              className={["week", w.w < thisWeek && "past", w.w === thisWeek && "now"].filter(Boolean).join(" ")}
            >
              <span className="week-amt">{w.total ? man(w.total) : "—"}</span>
              <div className="week-bar">
                <i style={{ height: `${(w.total / maxWeek) * 100}%` }} />
              </div>
              <span className="week-label">{w.w + 1}주</span>
              <span className="week-range">
                {w.from}–{w.to}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

