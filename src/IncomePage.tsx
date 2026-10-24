import { useEffect, useRef, useState } from "react";
import { bucketsInMonth, incomeFor, monthKey, type Assignments, type FixedItem, type Income } from "./schedule";
import { BUCKET_LABEL, INCOME_START, man, monthsInYear, num, pad2, parseWon, won } from "./format";

export function IncomePage(props: {
  items: FixedItem[];
  income: Income;
  assignments: Assignments;
  onSave: (next: Income) => void;
}) {
  const { income } = props;
  const now = new Date();
  const [year, setYear] = useState(Math.max(INCOME_START.year, now.getFullYear()));
  const [baseDraft, setBaseDraft] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const cancelled = useRef(false);

  useEffect(() => setBaseDraft(income.base ? num(income.base) : ""), [income.base]);

  const itemIds = new Set(props.items.map((it) => it.id));
  const months = monthsInYear(year).map((m) => {
    const key = monthKey(year, m);
    const earned = incomeFor(income, year, m);
    const { spend: fixed, save, give } = bucketsInMonth(props.items, year, m - 1, props.assignments);
    const current = year === now.getFullYear() && m === now.getMonth() + 1;
    // No set applied yet → fixed cost is unknown, not ₩0.
    const applied = (props.assignments[key] ?? []).some((id) => itemIds.has(id));
    const left = earned - fixed - save - give;
    return { m, key, earned, fixed, save, give, left, current, applied, custom: key in income.months };
  });
  // Totals cover applied months only, so unknown months don't inflate 남는 돈.
  const counted = months.filter((x) => x.applied);
  const unapplied = months.filter((x) => !x.applied);
  const sum = (pick: (x: (typeof months)[number]) => number) => counted.reduce((s, x) => s + pick(x), 0);
  const earnedTotal = sum((x) => x.earned);
  const fixedTotal = sum((x) => x.fixed);
  const saveTotal = sum((x) => x.save);
  const giveTotal = sum((x) => x.give);
  const left = sum((x) => x.left);
  const span =
    counted.length === months.length && months.length < 12
      ? ` (${months[0].m}–12월)`
      : counted.length < months.length
        ? ` · 적용 ${counted.length}개월`
        : "";

  function commitBase() {
    const base = parseWon(baseDraft);
    if (base !== income.base) props.onSave({ ...income, base });
    else setBaseDraft(base ? num(base) : "");
  }

  function startMonth(m: number, earned: number) {
    cancelled.current = false;
    setEditing(m);
    setDraft(earned ? num(earned) : "");
  }

  function commitMonth(key: string) {
    setEditing(null);
    if (cancelled.current) return;
    const nextMonths = { ...income.months };
    const value = parseWon(draft);
    if (draft.trim() === "" || value === income.base) delete nextMonths[key];
    else nextMonths[key] = value;
    props.onSave({ ...income, months: nextMonths });
  }

  function resetMonth(key: string) {
    const nextMonths = { ...income.months };
    delete nextMonths[key];
    props.onSave({ ...income, months: nextMonths });
  }

  return (
    <>
      <section className="income-head">
        <label className="income-base">
          <span className="field-label">기본 월수입</span>
          <span className="income-base-input">
            <em>₩</em>
            <input
              inputMode="numeric"
              value={baseDraft}
              onChange={(e) => setBaseDraft(e.target.value)}
              onBlur={commitBase}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              placeholder="0"
            />
          </span>
          <span className="income-hint">매달 같은 금액이 기본으로 들어가고, 다른 달만 아래에서 따로 바꾸면 됩니다.</span>
        </label>
        <div className="year-switch">
          <button
            type="button"
            onClick={() => setYear(year - 1)}
            disabled={year <= INCOME_START.year}
            aria-label="이전 해"
          >
            ‹
          </button>
          <span>{year}</span>
          <button type="button" onClick={() => setYear(year + 1)} aria-label="다음 해">
            ›
          </button>
        </div>
      </section>

      <section
        className={months.length < 12 ? "months partial" : "months"}
        style={months.length < 12 ? { gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))` } : undefined}
      >
        {months.map(({ m, key, earned, fixed, save, give, current, applied, custom }) => {
          const out = fixed + save + give;
          const scale = Math.max(earned, out, 1);
          const ratio = applied && earned > 0 ? fixed / earned : 0;
          return (
            <div
              key={key}
              className={["mcell", current && "current", custom && "custom", !applied && "unapplied"]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="mcell-head">
                <span className="mono-label">{pad2(m)}</span>
                {custom && (
                  <button type="button" className="mcell-reset" onClick={() => resetMonth(key)}>
                    기본값
                  </button>
                )}
              </div>
              {editing === m ? (
                <input
                  autoFocus
                  className="mcell-input"
                  inputMode="numeric"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitMonth(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") cancelled.current = true;
                    if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
                  }}
                />
              ) : (
                <button type="button" className="mcell-amt" onClick={() => startMonth(m, earned)}>
                  ₩{num(earned)}
                </button>
              )}
              <div className={applied && out > earned ? "mcell-bar over" : "mcell-bar"}>
                {applied &&
                  (
                    [
                      { k: "fixed", v: fixed },
                      { k: "save", v: save },
                      { k: "give", v: give },
                    ] as const
                  ).map(({ k, v }) => <i key={k} className={`seg-${k}`} style={{ width: `${(v / scale) * 100}%` }} />)}
              </div>
              <div className="mcell-foot">
                {applied ? (
                  <>
                    <span>
                      지출 ₩{num(fixed)}
                      {save > 0 && <em className="b-save">저축 ₩{num(save)}</em>}
                      {give > 0 && <em className="b-give">나눔 ₩{num(give)}</em>}
                    </span>
                    <span>{earned > 0 ? `${Math.round(ratio * 100)}%` : "—"}</span>
                  </>
                ) : (
                  <span className="mcell-unapplied">세트 미적용</span>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <dl className="income-sum">
        <div>
          <dt>
            {year} 수입{span}
          </dt>
          <dd>₩{num(earnedTotal)}</dd>
        </div>
        <div>
          <dt>{BUCKET_LABEL.spend}</dt>
          <dd>
            ₩{num(fixedTotal)}
            <em>{pct(fixedTotal, earnedTotal)}</em>
          </dd>
        </div>
        <div>
          <dt>남는 돈</dt>
          <dd className={left < 0 ? "neg" : "accent"}>{won(left)}</dd>
        </div>
        <div>
          <dt>{BUCKET_LABEL.save}</dt>
          <dd className="b-save">
            ₩{num(saveTotal)}
            <em>저축률 {pct(saveTotal, earnedTotal)}</em>
          </dd>
        </div>
        <div>
          <dt>{BUCKET_LABEL.give}</dt>
          <dd className="b-give">
            ₩{num(giveTotal)}
            <em>{pct(giveTotal, earnedTotal)}</em>
          </dd>
        </div>
        <div>
          <dt>나가는 돈 합계</dt>
          <dd>
            ₩{num(fixedTotal + saveTotal + giveTotal)}
            <em>{pct(fixedTotal + saveTotal + giveTotal, earnedTotal)}</em>
          </dd>
        </div>
      </dl>

      <FlowChart months={months} />
      {unapplied.length > 0 && (
        <p className="income-note">
          세트를 적용하지 않은 {unapplied.map((x) => `${x.m}월`).join(", ")}은 나가는 돈을 알 수 없어 합계에서 뺐습니다.
          장부에서 세트를 적용하면 반영됩니다.
        </p>
      )}
    </>
  );
}

const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

function niceMax(value: number, ticks: number) {
  if (value <= 0) return ticks;
  const raw = value / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  return step * ticks;
}

function FlowChart({
  months,
}: {
  months: {
    m: number;
    key: string;
    earned: number;
    fixed: number;
    save: number;
    give: number;
    left: number;
    applied: boolean;
  }[];
}) {
  const TICKS = 4;
  const rows = months;
  const top = niceMax(
    Math.max(0, ...rows.flatMap((r) => (r.applied ? [r.earned, r.fixed, r.save, r.left] : [r.earned]))),
    TICKS
  );
  const minLeft = Math.min(0, ...rows.filter((r) => r.applied).map((r) => r.left));
  const bottom = minLeft < 0 ? -Math.ceil(-minLeft / (top / TICKS)) * (top / TICKS) : 0;
  const steps = Math.round((top - bottom) / (top / TICKS));

  const x = (i: number) => ((i + 0.5) / rows.length) * 100;
  const y = (v: number) => ((top - v) / (top - bottom)) * 100;
  type Row = (typeof rows)[number];
  // Outflow series only run through months with a set applied; income runs through all.
  const shown = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.applied);
  const all = rows.map((r, i) => ({ r, i }));
  const path = (pick: (r: Row) => number, pts = shown) =>
    pts.map(({ r, i }, n) => `${n ? "L" : "M"}${x(i)},${y(pick(r))}`).join(" ");
  const area = shown.length
    ? `${path((r) => r.left)} L${x(shown[shown.length - 1].i)},${y(0)} L${x(shown[0].i)},${y(0)} Z`
    : "";

  const series = [
    { key: "earned", label: "수입", d: path((r) => r.earned, all), pick: (r: Row) => y(r.earned), always: true },
    { key: "fixed", label: BUCKET_LABEL.spend, d: path((r) => r.fixed), pick: (r: Row) => y(r.fixed), always: false },
    { key: "save", label: BUCKET_LABEL.save, d: path((r) => r.save), pick: (r: Row) => y(r.save), always: false },
    { key: "left", label: "남는 돈", d: path((r) => r.left), pick: (r: Row) => y(r.left), always: false },
  ];

  return (
    <section className="flow">
      <div className="flow-head">
        <span className="mono-label">Monthly flow</span>
        <ul className="flow-legend">
          {series.map((s) => (
            <li key={s.key}>
              <i className={`k-${s.key}`} />
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <div className="flow-plot">
        {Array.from({ length: steps + 1 }, (_, i) => {
          const v = bottom + (top / TICKS) * i;
          return (
            <div key={i} className={v === 0 ? "flow-line zero" : "flow-line"} style={{ bottom: `${(i / steps) * 100}%` }}>
              <span>{man(v)}</span>
            </div>
          );
        })}
        <svg className="flow-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="flow-left-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#94efc3" stopOpacity="0.18" />
              <stop offset="1" stopColor="#94efc3" stopOpacity="0" />
            </linearGradient>
          </defs>
          {area && <path d={area} fill="url(#flow-left-fill)" />}
          {series.map((s) => (
            <path key={s.key} d={s.d} className={`ln-${s.key}`} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        <div className="flow-cols">
          {rows.map((r, i) => (
            <div key={r.key} className={r.applied ? "flow-col" : "flow-col unapplied"}>
              <span className="flow-guide" />
              {series.filter((s) => s.always || r.applied).map((s) => (
                <i
                  key={s.key}
                  className={`pt pt-${s.key}${s.key === "left" && r.left < 0 ? " neg" : ""}`}
                  style={{ top: `${s.pick(r)}%` }}
                />
              ))}
              <div
                className={
                  rows.length <= 3 ? "flow-tip" : i >= rows.length - 2 ? "flow-tip flip" : i < 2 ? "flow-tip start" : "flow-tip"
                }
              >
                <strong>{r.m}월</strong>
                <span>
                  수입 <b>₩{num(r.earned)}</b>
                </span>
                {r.applied ? (
                  <>
                    <span>
                      {BUCKET_LABEL.spend} <b>₩{num(r.fixed)}</b>
                    </span>
                    {r.save > 0 && (
                      <span>
                        {BUCKET_LABEL.save} <b className="b-save">₩{num(r.save)}</b>
                      </span>
                    )}
                    {r.give > 0 && (
                      <span>
                        {BUCKET_LABEL.give} <b className="b-give">₩{num(r.give)}</b>
                      </span>
                    )}
                    <span>
                      남는 돈 <b className={r.left < 0 ? "neg" : "accent"}>{won(r.left)}</b>
                    </span>
                    {r.save > 0 && (
                      <span>
                        저축률 <b className="b-save">{pct(r.save, r.earned)}</b>
                      </span>
                    )}
                  </>
                ) : (
                  <span>
                    {BUCKET_LABEL.spend} <b>세트 미적용</b>
                  </span>
                )}
              </div>
              <span className="flow-label">{r.m}월</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
