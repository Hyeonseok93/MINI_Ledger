import { useMemo, useState } from "react";
import { analyze, incomeFor, type Assignments, type FixedItem, type Income } from "./schedule";
import {
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
  const monthSpend = stats.monthlyTotal;
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
              <dt>적용 항목</dt>
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
            <CategoryInsight monthSpend={monthSpend} byCategory={byMonthCat} occurrences={stats.occurrences} />
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
