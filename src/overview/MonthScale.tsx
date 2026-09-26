import { CYCLE_LABEL, type Analytics } from "../schedule";
import { DAYS, num } from "../format";

export function MonthScale({ stats }: { stats: Analytics }) {
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
