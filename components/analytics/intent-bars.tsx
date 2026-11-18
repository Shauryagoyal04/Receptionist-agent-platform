import Link from "next/link";

import { formatMetric } from "@/components/analytics/format";
import { INTENT_CHART_COLOR, INTENT_LABELS, type IntentId } from "@/lib/types";
import type { CountShare } from "@/lib/analytics/aggregate";

const TOP = 6;

/**
 * What patients asked about, ranked. The top six intents get their own row
 * and colour; anything past that folds into "Other", which is always last
 * and grey. With no conversations the rows are drawn as ghosts at zero, so
 * staff can see what this panel will show.
 */
export function IntentBars({
  data,
  hrefFor,
}: {
  data: CountShare<IntentId>[];
  hrefFor: (intent: IntentId) => string;
}) {
  const total = data.reduce((sum, entry) => sum + entry.count, 0);

  if (total === 0) {
    const ghosts: IntentId[] = ["book_appointment", "doctor_availability", "consultation_fees", "clinic_info", "reschedule_appointment"];
    return (
      <div>
        <ul className="flex flex-col gap-3" aria-hidden="true">
          {ghosts.map((id) => (
            <li key={id} className="grid grid-cols-[9.5rem_1fr_2rem] items-center gap-3">
              <span className="text-ink-4 truncate text-[13px]">{INTENT_LABELS[id]}</span>
              <span className="bg-sunken h-2 rounded-full" />
              <span className="tnum text-ink-4 text-right text-[13px]">0</span>
            </li>
          ))}
        </ul>
        <p className="text-ink-3 mt-4 text-[13px]">Topics appear after the first few conversations.</p>
      </div>
    );
  }

  const ranked = data
    .filter((entry) => entry.key !== "other" && entry.count > 0)
    .sort((a, b) => b.count - a.count);
  const shown = ranked.slice(0, TOP);
  const otherCount =
    ranked.slice(TOP).reduce((sum, entry) => sum + entry.count, 0) +
    (data.find((entry) => entry.key === "other")?.count ?? 0);
  const rows: Array<{ key: IntentId; count: number }> = [
    ...shown,
    ...(otherCount > 0 ? [{ key: "other" as const, count: otherCount }] : []),
  ];
  const max = Math.max(...rows.map((row) => row.count));

  return (
    <ol className="flex flex-col gap-1">
      {rows.map((row, index) => (
        <li key={row.key}>
          <Link
            href={hrefFor(row.key)}
            className="hover:bg-sunken/60 -mx-2 grid grid-cols-[9.5rem_1fr_2.5rem] items-center gap-3 rounded-lg px-2 py-1.5 transition-colors duration-(--dur-quick)"
          >
            <span className="text-ink-2 truncate text-[13px]">{INTENT_LABELS[row.key]}</span>
            <span className="h-2">
              <span
                className="md-grow-x block h-full rounded-full"
                style={{
                  width: `${Math.max(2, (row.count / max) * 100)}%`,
                  backgroundColor: INTENT_CHART_COLOR[row.key],
                  animationDelay: `${index * 40}ms`,
                }}
              />
            </span>
            <span className="tnum text-ink text-right text-[13px] font-medium">
              {formatMetric("count", row.count)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
