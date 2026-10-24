import { useMemo, useState } from "react";
import { analyze, incomeFor, type Assignments, type FixedItem, type Income } from "./schedule";
import {
  BUCKET_LABEL,
  bucketOf,
  canShiftPrev,
  num,
  shiftYearMonth,
  won,
  yearMonthFromDate,
  ymLabel,
  type YearMonth,
} from "./format";
import { categoryFromOccurrences } from "./overview/categoryFromOccurrences";
import { MonthScale } from "./overview/MonthScale";
import { Categories } from "./overview/Categories";
import { Upcoming } from "./overview/Upcoming";
import { CategoryInsight } from "./overview/CategoryInsight";
import { RhythmInsight } from "./overview/RhythmInsight";

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
  // The hero figure is everything going out (spending + savings); the bar legend breaks it down.
  const { spend: monthSpend, save } = stats.buckets;
  const outflow = stats.monthlyTotal;
  const earned = incomeFor(props.income, cursor.year, cursor.month);
  const byMonthCat = useMemo(() => categoryFromOccurrences(stats.occurrences), [stats.occurrences]);
  const spendCats = byMonthCat.filter((c) => bucketOf(c.category) === "spend");

  const left = earned - outflow;
  const scale = Math.max(earned, outflow, 1);
  const segs = [
    { key: "fixed", label: BUCKET_LABEL.spend, amount: monthSpend, show: true },
    { key: "save", label: BUCKET_LABEL.save, amount: save, show: save > 0 },
  ].filter((s) => s.show);

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
            Monthly total · {ymLabel(cursor)}
            {isCurrent && <em className="month-now">이번 달</em>}
          </span>
          <button type="button" onClick={() => setCursor((c) => shiftYearMonth(c, 1))} aria-label="다음 달">
            ›
          </button>
        </div>
        <div className="figure">
          <span className="figure-cur">₩</span>
          <span className="figure-num">{num(outflow)}</span>
        </div>
        <div className="hero-meta-row">
          <dl className="hero-meta">
            {earned > 0 ? (
              <>
                <div>
                  <dt>수입 대비</dt>
                  <dd>
                    {Math.round((outflow / earned) * 100)}%
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
              <dt>적용 항목</dt>
              <dd>{stats.count}건</dd>
            </div>
          </dl>

          {earned > 0 && (
            <div className="hero-split" aria-label="수입이 나가는 곳">
              <span className="mono-label">Where income goes</span>
              <div className={left < 0 ? "hero-bar over" : "hero-bar"}>
                {segs.map((s) => (
                  <i
                    key={s.key}
                    className={`seg ${s.key}`}
                    style={{ width: `${(s.amount / scale) * 100}%` }}
                    title={`${s.label} ₩${num(s.amount)}`}
                  />
                ))}
                {left > 0 && (
                  <i className="seg left" style={{ width: `${(left / scale) * 100}%` }} title={`남는 돈 ₩${num(left)}`} />
                )}
              </div>
              <div className="hero-bar-legend">
                {segs.map((s) => (
                  <span key={s.key}>
                    <i className={`sw ${s.key}`} />
                    <span>{s.label}</span>
                    <b>
                      ₩{num(s.amount)}
                      {s.key === "save" && <em>{Math.round((save / earned) * 100)}%</em>}
                    </b>
                  </span>
                ))}
                <span>
                  <i className={left < 0 ? "sw neg" : "sw left"} />
                  <span>남는 돈</span>
                  <b className={left < 0 ? "neg" : undefined}>{won(left)}</b>
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
            <CategoryInsight monthSpend={monthSpend} byCategory={spendCats} occurrences={stats.occurrences} />
            <Categories buckets={stats.buckets} byCategory={byMonthCat} />
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
