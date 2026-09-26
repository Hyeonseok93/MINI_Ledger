import { useMemo, useState } from "react";
import {
  analyze,
  CYCLE_LABEL,
  dueWithin,
  incomeFor,
  perMonth,
  upcomingInWindow,
  type Analytics,
  type Assignments,
  type FixedItem,
  type Income,
  type Occurrence,
} from "./schedule";
import {
  canShiftPrev,
  DAYS,
  SHADES,
  man,
  num,
  pad2,
  shiftYearMonth,
  won,
  yearMonthFromDate,
  ymLabel,
  type YearMonth,
} from "./format";

export function Overview(props: {
  items: FixedItem[];
  income: Income;
  assignments: Assignments;
  onIncome: () => void;
}) {
  const asOf = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState<YearMonth>(() => yearMonthFromDate(asOf));
  const view = useMemo(() => new Date(cursor.year, cursor.month - 1, 1), [cursor]);
  const stats = useMemo(
    () => analyze(props.items, view, asOf, props.assignments),
    [props.items, props.assignments, view, asOf]
  );

  const isCurrent =
    cursor.year === asOf.getFullYear() && cursor.month === asOf.getMonth() + 1;
  const monthSpend = stats.occurrences.reduce((s, o) => s + o.item.amount, 0);
  const earned = incomeFor(props.income, cursor.year, cursor.month);
  const byMonthCat = useMemo(() => categoryFromOccurrences(stats.occurrences), [stats.occurrences]);

  const left = earned - monthSpend;
  const fixedShare = earned > 0 ? Math.min(100, (monthSpend / Math.max(earned, monthSpend)) * 100) : 0;
  const leftShare = earned > 0 && left > 0 ? (left / earned) * 100 : 0;

  return (
    <>
      <section className="hero">
        <div className="month-switch">
          <button
            type="button"
            disabled={!canShiftPrev(cursor)}
            onClick={() => setCursor((c) => shiftYearMonth(c, -1))}
            aria-label="이전 달"
          >
            ‹
          </button>
          <span className="mono-label">
            Monthly fixed · {ymLabel(cursor)}
            {isCurrent && <em className="month-now">이번 달</em>}
          </span>
          <button type="button" onClick={() => setCursor((c) => shiftYearMonth(c, 1))} aria-label="다음 달">
            ›
          </button>
        </div>
        <div className="figure">
          <span className="figure-cur">₩</span>
          <span className="figure-num">{num(monthSpend)}</span>
        </div>
        <div className="hero-meta-row">
          <dl className="hero-meta">
            {earned > 0 ? (
              <>
                <div>
                  <dt>수입 대비</dt>
                  <dd>
                    {Math.round((monthSpend / earned) * 100)}%
                    <em className="meta-sub">₩{num(earned)}</em>
                  </dd>
                </div>
                <div>
                  <dt>남는 돈</dt>
                  <dd className={left < 0 ? "neg" : "accent"}>{won(left)}</dd>
                </div>
              </>
            ) : (
              <div>
                <dt>수입 대비</dt>
                <dd>
                  <button type="button" className="link" onClick={props.onIncome}>
                    수입 설정 →
                  </button>
                </dd>
              </div>
            )}
            <div>
              <dt>활성 항목</dt>
              <dd>{stats.count}건</dd>
            </div>
          </dl>

          {earned > 0 && (
            <div className="hero-split" aria-label="고정비와 남는 돈 비율">
              <span className="mono-label">Fixed vs left</span>
              <div className={left < 0 ? "hero-bar over" : "hero-bar"}>
                <i
                  className="seg fixed"
                  style={{ width: `${fixedShare}%` }}
                  title={`고정비 ₩${num(monthSpend)}`}
                />
                {left > 0 && (
                  <i className="seg left" style={{ width: `${leftShare}%` }} title={`남는 돈 ₩${num(left)}`} />
                )}
              </div>
              <div className="hero-bar-legend">
                <span>
                  <i className="sw fixed" />
                  고정비 <b>₩{num(monthSpend)}</b>
                </span>
                <span>
                  <i className={left < 0 ? "sw neg" : "sw left"} />
                  남는 돈 <b className={left < 0 ? "neg" : undefined}>{won(left)}</b>
                </span>
              </div>
            </div>
          )}
        </div>
      </section>

      <MonthScale stats={stats} />

      {stats.count === 0 ? (
        <section className="empty">
          <span className="mono-label">Fixed costs</span>
          <p className="empty-title">
            {props.items.length === 0
              ? "아직 등록된 고정비가 없습니다"
              : `${ymLabel(cursor)}에 적용된 항목이 없습니다`}
          </p>
        </section>
      ) : (
        <>
          <section className="cols">
            <CategoryInsight monthSpend={monthSpend} byCategory={byMonthCat} items={props.items} />
            <Categories monthSpend={monthSpend} byCategory={byMonthCat} />
          </section>
          <section className="cols">
            <RhythmInsight
              stats={stats}
              items={props.items}
              assignments={props.assignments}
              cursor={cursor}
              asOf={asOf}
              isCurrent={isCurrent}
            />
            <Upcoming
              items={props.items}
              assignments={props.assignments}
              cursor={cursor}
              asOf={asOf}
            />
          </section>
        </>
      )}
    </>
  );
}

function categoryFromOccurrences(occurrences: Occurrence[]) {
  const map = new Map<string, number>();
  for (const o of occurrences) map.set(o.item.category, (map.get(o.item.category) ?? 0) + o.item.amount);
  return [...map]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}

function MonthScale({ stats }: { stats: Analytics }) {
  const days = stats.daysInMonth;
  const pos = (d: number) => ((d - 1) / (days - 1)) * 100;
  const showToday = stats.today >= 1 && stats.today <= days;
  const pastWidth = stats.today <= 0 ? 0 : stats.today > days ? 100 : pos(stats.today);

  const plotted = stats.occurrences.filter((o) => o.item.cycle !== "daily");
  const dailyCount = new Set(stats.occurrences.filter((o) => o.item.cycle === "daily").map((o) => o.item.id)).size;
  const max = Math.max(1, ...plotted.map((o) => o.item.amount));
  const stackAt = new Map<number, number>();
  const dots = [...plotted]
    .sort((a, b) => b.item.amount - a.item.amount)
    .map((o) => {
      const size = 9 + Math.sqrt(o.item.amount / max) * 27;
      const offset = stackAt.get(o.day) ?? 0;
      stackAt.set(o.day, offset + size + 4);
      return { ...o, size, offset };
    });
  const stackPeak = dots.reduce((m, d) => Math.max(m, d.offset + d.size), 0);
  const trackHeight = Math.max(112, 14 + stackPeak + 16);

  return (
    <section className="scale">
      <div className="scale-head">
        <div>
          <span className="mono-label">Passed</span>
          <strong>₩{num(stats.paidThisMonth)}</strong>
        </div>
        <div className="right">
          <span className="mono-label">Remaining</span>
          <strong className="accent">₩{num(stats.remainingThisMonth)}</strong>
        </div>
      </div>

      <div className="scale-track" style={{ height: trackHeight }}>
        <div className="scale-past" style={{ width: `${pastWidth}%` }} />
        {DAYS.slice(0, days).map((d) => {
          const major = d === 1 || d % 5 === 0 || d === days;
          return (
            <div key={d} className={major ? "tick major" : "tick"} style={{ left: `${pos(d)}%` }}>
              {major && <span>{String(d).padStart(2, "0")}</span>}
            </div>
          );
        })}
        {dots.map(({ item, day, size, offset }) => (
          <div
            key={`${item.id}-${day}`}
            className={[day < stats.today ? "dot past" : "dot", day > days * 0.72 ? "tip-left" : ""]
              .filter(Boolean)
              .join(" ")}
            style={{ left: `${pos(day)}%`, width: size, height: size, bottom: 14 + offset }}
          >
            <span className="dot-tip">
              <b>{day}일</b>
              <strong>{item.name}</strong>
              <em>₩{num(item.amount)}</em>
              <i>{CYCLE_LABEL[item.cycle]}</i>
            </span>
          </div>
        ))}
        {showToday && (
          <div className="scale-today" style={{ left: `${pos(stats.today)}%` }}>
            <span>Today {String(stats.today).padStart(2, "0")}</span>
          </div>
        )}
      </div>
      {dailyCount > 0 && (
        <p className="scale-note">매일 결제 {dailyCount}건은 합계에만 포함하고 눈금에는 표시하지 않습니다.</p>
      )}
    </section>
  );
}

function Categories({
  monthSpend,
  byCategory,
}: {
  monthSpend: number;
  byCategory: { category: string; amount: number }[];
}) {
  const total = Math.max(1, monthSpend);
  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">By category · this month</span>
        <span className="mono-label dim">{byCategory.length}</span>
      </div>
      <div className="stack">
        {byCategory.map((c, i) => (
          <i key={c.category} style={{ width: `${(c.amount / total) * 100}%`, opacity: SHADES[i] ?? 0.1 }} />
        ))}
      </div>
      <ul className="rows">
        {byCategory.map((c, i) => (
          <li key={c.category} className="row cat">
            <span className="swatch" style={{ opacity: SHADES[i] ?? 0.1 }} />
            <span className="row-name">{c.category}</span>
            <span className="row-pct">{Math.round((c.amount / total) * 100)}%</span>
            <span className="row-amt">₩{num(c.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Upcoming({
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

function CategoryInsight({
  monthSpend,
  byCategory,
  items,
}: {
  monthSpend: number;
  byCategory: { category: string; amount: number }[];
  items: FixedItem[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = Math.max(1, monthSpend);
  const cats = byCategory;
  const active = items.filter((it) => it.active);

  const R = 100;
  const C = 2 * Math.PI * R;
  const GAP = cats.length > 1 ? 3 : 0;
  let acc = 0;
  const arcs = cats.map((c, i) => {
    const len = (c.amount / total) * C;
    const arc = { ...c, len, offset: -acc, shade: SHADES[i] ?? 0.1 };
    acc += len;
    return arc;
  });

  const focus = cats.find((c) => c.category === hover);
  const members = focus
    ? active.filter((it) => it.category === focus.category).sort((a, b) => perMonth(b) - perMonth(a))
    : [];

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Category share · this month</span>
        <span className="mono-label dim head-count">
          <b>{cats.length}</b>
          <i>분류</i>
        </span>
      </div>
      <div className="pie">
        <div className="donut">
          <svg viewBox="0 0 240 240" onMouseLeave={() => setHover(null)}>
            <circle cx="120" cy="120" r={R} className="donut-track" />
            {arcs.map((a) => (
              <circle
                key={a.category}
                cx="120"
                cy="120"
                r={R}
                className={["donut-arc", hover === a.category && "on", hover && hover !== a.category && "off"]
                  .filter(Boolean)
                  .join(" ")}
                style={{ ["--shade" as string]: a.shade }}
                strokeDasharray={`${Math.max(0.5, a.len - GAP)} ${C}`}
                strokeDashoffset={a.offset}
                onMouseEnter={() => setHover(a.category)}
              />
            ))}
          </svg>
          <div className="donut-center">
            {focus ? (
              <>
                <span className="dc-label">{focus.category}</span>
                <strong>{Math.round((focus.amount / total) * 100)}%</strong>
                <span className="dc-amt">₩{num(focus.amount)}</span>
                <span className="dc-items">{members.map((m) => m.name).join(" · ")}</span>
              </>
            ) : (
              <>
                <span className="dc-label">이 달 고정비</span>
                <strong className="sm">₩{num(monthSpend)}</strong>
                <span className="dc-hint">조각에 마우스를 올려보세요</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RhythmInsight({
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
