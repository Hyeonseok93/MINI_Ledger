import { BUCKETS, BUCKET_LABEL, SHADES, bucketOf, num } from "../format";
import type { BucketTotals } from "../schedule";

/** Every category this month, grouped by bucket; percentages are of the bucket's total. */
export function Categories({
  buckets,
  byCategory,
}: {
  buckets: BucketTotals;
  byCategory: { category: string; amount: number }[];
}) {
  const groups = BUCKETS.map((b) => ({
    bucket: b,
    total: buckets[b],
    cats: byCategory.filter((c) => bucketOf(c.category) === b),
  })).filter((g) => g.cats.length > 0);

  return (
    <div className="col">
      <div className="col-head">
        <span className="mono-label">By category · this month</span>
        <span className="mono-label dim">{byCategory.length}</span>
      </div>
      {groups.map(({ bucket, total, cats }) => (
        <div key={bucket} className={`cat-group b-${bucket}`}>
          {groups.length > 1 && (
            <div className="cat-group-head">
              <span>{BUCKET_LABEL[bucket]}</span>
              <b>₩{num(total)}</b>
            </div>
          )}
          <div className="stack">
            {cats.map((c, i) => (
              <i
                key={c.category}
                style={{ width: `${(c.amount / Math.max(1, total)) * 100}%`, opacity: SHADES[i] ?? 0.1 }}
              />
            ))}
          </div>
          <ul className="rows">
            {cats.map((c, i) => (
              <li key={c.category} className="row cat">
                <span className="swatch" style={{ opacity: SHADES[i] ?? 0.1 }} />
                <span className="row-name">{c.category}</span>
                <span className="row-pct">{Math.round((c.amount / Math.max(1, total)) * 100)}%</span>
                <span className="row-amt">₩{num(c.amount)}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
