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

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Upcoming · month + next week</span>
        <span className="mono-label dim">{all.length}</span>
      </div>
      <ul className="rows">
        {all.length === 0 && (
          <li className="row-empty">이 달 남은 결제와 다음 달 첫 주에 예정된 항목이 없습니다.</li>
        )}
        {all.map(({ item, date, dday }) => (
          <li key={`${item.id}-${date.getTime()}`} className="row up">
            <span className={dday === 0 ? "row-d today" : "row-d"}>{dday === 0 ? "TODAY" : `D−${dday}`}</span>
            <span className="row-name">
              {item.name}
              <em>
                {pad2(date.getMonth() + 1)}.{pad2(date.getDate())} · {CYCLE_LABEL[item.cycle]}
              </em>
            </span>
            <span className="row-amt">₩{num(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
