import { CYCLE_LABEL, upcomingInWindow, type Assignments, type FixedItem } from "../schedule";
import { num, pad2, type YearMonth } from "../format";

export function Upcoming({
  items,
  assignments,
  cursor,
  asOf,
}: {
  items: FixedItem[];
  assignments: Assignments;
  cursor: YearMonth;
  asOf: Date;
}) {
  const all = upcomingInWindow(items, cursor.year, cursor.month, asOf, assignments);
  const rows = collapseDaily(all);

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Upcoming · month + next week</span>
        <span className="mono-label dim">{rows.length}</span>
      </div>
      <ul className="rows">
        {rows.length === 0 && (
          <li className="row-empty">이 달 남은 결제와 다음 달 첫 주에 예정된 항목이 없습니다.</li>
        )}
        {rows.map(({ item, date, dday, last, count, total }) => (
          <li key={`${item.id}-${date.getTime()}`} className="row up">
            <span className={dday === 0 ? "row-d today" : "row-d"}>{dday === 0 ? "TODAY" : `D−${dday}`}</span>
            <span className="row-name">
              {item.name}
              <em>
                {mmdd(date)}
                {count > 1 && `–${mmdd(last)}`} · {CYCLE_LABEL[item.cycle]}
                {count > 1 && ` ${count}회`}
              </em>
            </span>
            <span className="row-amt">₩{num(total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const mmdd = (d: Date) => `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;

type Entry = ReturnType<typeof upcomingInWindow>[number];

/** Daily items would fill the list one row per day; fold each into one row at its first date. */
function collapseDaily(entries: Entry[]) {
  const rows: (Entry & { last: Date; count: number; total: number })[] = [];
  const daily = new Map<string, (typeof rows)[number]>();
  for (const e of entries) {
    const seen = e.item.cycle === "daily" ? daily.get(e.item.id) : undefined;
    if (seen) {
      seen.last = e.date;
      seen.count += 1;
      seen.total += e.item.amount;
      continue;
    }
    const row = { ...e, last: e.date, count: 1, total: e.item.amount };
    if (e.item.cycle === "daily") daily.set(e.item.id, row);
    rows.push(row);
  }
  return rows;
}
