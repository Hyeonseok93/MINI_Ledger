import { useMemo, useState } from "react";
import type { Occurrence } from "../schedule";
import { SHADES, num } from "../format";

export function CategoryInsight({
  monthSpend,
  byCategory,
  occurrences,
}: {
  monthSpend: number;
  byCategory: { category: string; amount: number }[];
  occurrences: Occurrence[];
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = Math.max(1, monthSpend);
  const cats = byCategory;

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
  const members = useMemo(() => {
    if (!focus) return [];
    const map = new Map<string, { name: string; amount: number }>();
    for (const o of occurrences) {
      if (o.item.category !== focus.category) continue;
      const prev = map.get(o.item.id);
      map.set(o.item.id, {
        name: o.item.name,
        amount: (prev?.amount ?? 0) + o.item.amount,
      });
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [focus, occurrences]);

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">Spending share · this month</span>
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
                <span className="dc-label">이 달 고정 지출</span>
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
