import type { Occurrence } from "../schedule";

export function categoryFromOccurrences(occurrences: Occurrence[]) {
  const map = new Map<string, number>();
  for (const o of occurrences) map.set(o.item.category, (map.get(o.item.category) ?? 0) + o.item.amount);
  return [...map]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);
}
