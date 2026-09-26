import { useState } from "react";
import {
  CYCLE_LABEL,
  daysUntil,
  dueWithin,
  incomeFor,
  nextOccurrence,
  perMonth,
  type Analytics,
  type FixedItem,
  type Income,
} from "./schedule";
import { DAYS, SHADES, man, num, pad2, won } from "./format";

export function Overview(props: {
  stats: Analytics;
  items: FixedItem[];
  income: Income;
  onAdd: () => void;
  onSample: () => void;
  onIncome: () => void;
}) {
  const { stats } = props;
  const now = new Date();
  const month = now.getMonth() + 1;
  const earned = incomeFor(props.income, now.getFullYear(), month);

  return (
    <>
      <section className="hero">
        <span className="mono-label">
          Monthly fixed · {now.getFullYear()}.{String(month).padStart(2, "0")}
        </span>
        <div className="figure">
          <span className="figure-cur">₩</span>
          <span className="figure-num">{num(stats.monthlyTotal)}</span>
        </div>
        <dl className="hero-meta">
          <div>
            <dt>연 환산</dt>
            <dd>₩{num(stats.yearlyTotal)}</dd>
          </div>
          {earned > 0 ? (
            <>
              <div>
                <dt>수입 대비</dt>
                <dd>{Math.round((stats.monthlyTotal / earned) * 100)}%</dd>
              </div>
              <div>
                <dt>남는 돈</dt>
                <dd className={earned - stats.monthlyTotal < 0 ? "neg" : "accent"}>
                  {won(earned - stats.monthlyTotal)}
                </dd>
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
      </section>

      <MonthScale stats={stats} />

      {stats.count === 0 ? (
        <section className="empty">
          <p>아직 등록된 고정비가 없습니다.</p>
          <div className="empty-actions">
            <button type="button" className="btn primary" onClick={props.onAdd}>
              장부에 추가
            </button>
            <button type="button" className="btn ghost" onClick={props.onSample}>
              예시 데이터로 보기
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="cols">
            <CategoryInsight stats={stats} items={props.items} />
            <Categories stats={stats} />
          </section>
          <section className="cols">
            <RhythmInsight stats={stats} items={props.items} />
            <Upcoming items={props.items} />
          </section>
        </>
      )}
    </>
  );
}

function MonthScale({ stats }: { stats: Analytics }) {
  const days = stats.daysInMonth;
  const pos = (d: number) => ((d - 1) / (days - 1)) * 100;

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

      <div className="scale-track">
        <div className="scale-past" style={{ width: `${pos(stats.today)}%` }} />
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
            className={day < stats.today ? "dot past" : "dot"}
            title={`${day}일 · ${item.name} · ₩${num(item.amount)} (${CYCLE_LABEL[item.cycle]})`}
            style={{ left: `${pos(day)}%`, width: size, height: size, bottom: 14 + offset }}
          />
        ))}
        <div className="scale-today" style={{ left: `${pos(stats.today)}%` }}>
          <span>Today {String(stats.today).padStart(2, "0")}</span>
        </div>
      </div>
      {dailyCount > 0 && (
        <p className="scale-note">매일 결제 {dailyCount}건은 합계에만 포함하고 눈금에는 표시하지 않습니다.</p>
      )}
    </section>
  );
}

function Categories({ stats }: { stats: Analytics }) {
  const total = Math.max(1, stats.monthlyTotal);
  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">By category · per month</span>
        <span className="mono-label dim">{stats.byCategory.length}</span>
      </div>
      <div className="stack">
        {stats.byCategory.map((c, i) => (
          <i key={c.category} style={{ width: `${(c.amount / total) * 100}%`, opacity: SHADES[i] ?? 0.1 }} />
        ))}
      </div>
      <ul className="rows">
        {stats.byCategory.map((c, i) => (
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

const UPCOMING_DAYS = 30;

function Upcoming({ items }: { items: FixedItem[] }) {
  const all = items
    .filter((it) => it.active)
    .map((item) => {
      const next = nextOccurrence(item);
      return { item, next, dday: daysUntil(next) };
    })
    .filter((x) => x.dday < UPCOMING_DAYS)
    .sort((a, b) => a.dday - b.dday || b.item.amount - a.item.amount);

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Upcoming · {UPCOMING_DAYS} days</span>
        <span className="mono-label dim">{all.length}</span>
      </div>
      <ul className="rows">
        {all.length === 0 && <li className="row-empty">{UPCOMING_DAYS}일 안에 예정된 결제가 없습니다.</li>}
        {all.map(({ item, next, dday }) => (
          <li key={item.id} className="row up">
            <span className={dday === 0 ? "row-d today" : "row-d"}>{dday === 0 ? "TODAY" : `D−${dday}`}</span>
            <span className="row-name">
              {item.name}
              <em>
                {pad2(next.getMonth() + 1)}.{pad2(next.getDate())} · {CYCLE_LABEL[item.cycle]}
              </em>
            </span>
            <span className="row-amt">₩{num(item.amount)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CategoryInsight({ stats, items }: { stats: Analytics; items: FixedItem[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const total = Math.max(1, stats.monthlyTotal);
  const cats = stats.byCategory;
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
        <span className="mono-label dim">{cats.length} 분류</span>
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
                <span className="dc-label">이번 달 고정비</span>
                <strong className="sm">₩{num(stats.monthlyTotal)}</strong>
                <span className="dc-hint">조각에 마우스를 올려보세요</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RhythmInsight({ stats, items }: { stats: Analytics; items: FixedItem[] }) {
  const now = new Date();
  const lead = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7;
  const weekOf = (d: number) => Math.floor((d - 1 + lead) / 7);
  const weekCount = weekOf(stats.daysInMonth) + 1;
  const thisWeek = weekOf(stats.today);

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
  const next7 = dueWithin(items, 7, now);
  const remainingCount = stats.occurrences.filter((o) => o.day >= stats.today).length;

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Payment rhythm · this month</span>
        <span className="mono-label dim">{weekCount} weeks</span>
      </div>
      <div className="rhythm">
        <dl className="rhythm-stats">
          <div>
            <dt>다음 7일</dt>
            <dd>₩{num(next7.total)}</dd>
            <small>{next7.count}건</small>
          </div>
          <div>
            <dt>이번 달 남은 결제</dt>
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
