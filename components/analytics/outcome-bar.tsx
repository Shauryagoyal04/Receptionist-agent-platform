import { OUTCOME_CHART_COLOR, OUTCOME_LABELS, type Outcome } from "@/lib/types";
import type { CountShare } from "@/lib/analytics/aggregate";

/**
 * Outcomes as a single stacked bar with a counted legend.
 *
 * A donut would be worse here: the eye cannot compare small slices across a
 * curve, and "no resolution" at 4% is exactly the segment someone needs to
 * read accurately. One row plus explicit counts is both compact and precise.
 */
export function OutcomeBar({ data }: { data: CountShare<Outcome>[] }) {
  const rows = data.filter((entry) => entry.count > 0);
  const total = rows.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">
        No conversations in this range
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="bg-muted flex h-6 w-full overflow-hidden rounded-md"
        role="img"
        aria-label={rows
          .map(
            (entry) =>
              `${OUTCOME_LABELS[entry.key]}: ${entry.count}, ${(entry.share * 100).toFixed(1)} percent`,
          )
          .join("; ")}
      >
        {rows.map((entry) => (
          <div
            key={entry.key}
            style={{
              width: `${entry.share * 100}%`,
              backgroundColor: OUTCOME_CHART_COLOR[entry.key],
            }}
            // The bar is one image for assistive tech; the legend below
            // carries the same numbers as text.
            aria-hidden="true"
          />
        ))}
      </div>

      <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: OUTCOME_CHART_COLOR[entry.key] }}
            />
            <span className="truncate">{OUTCOME_LABELS[entry.key]}</span>
            <span className="tabular text-muted-foreground ml-auto font-mono text-xs">
              {entry.count} · {(entry.share * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
