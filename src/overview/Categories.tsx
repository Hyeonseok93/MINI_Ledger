import { SHADES, num } from "../format";

export function Categories({
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
