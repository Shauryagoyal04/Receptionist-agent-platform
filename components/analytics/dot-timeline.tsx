import { formatDayKey } from "@/components/analytics/format";
import { CHANNEL_CHART_COLOR, CHANNEL_LABELS } from "@/lib/types";
import { daysBetweenKeys } from "@/lib/time";
import type { RecentConversationRow } from "@/lib/analytics/aggregate";

/**
 * With fewer than five conversations a 30-day trend line is a flat line with
 * a bump. This shows each conversation as a dot on its day instead, coloured
 * by channel, which says the same thing honestly.
 */
export function DotTimeline({
  conversations,
  from,
  to,
  timeZone,
  height,
}: {
  conversations: RecentConversationRow[];
  from: string;
  to: string;
  timeZone: string;
  height: number;
}) {
  const span = Math.max(1, daysBetweenKeys(from, to) - 1);
  const perDay = new Map<string, number>();

  return (
    <div className="flex flex-col justify-center" style={{ height }}>
      <div className="relative mx-2 h-16">
        <div className="bg-line absolute inset-x-0 bottom-4 h-px" />
        {conversations.map((c) => {
          const stack = perDay.get(c.day) ?? 0;
          perDay.set(c.day, stack + 1);
          const left = ((daysBetweenKeys(from, c.day) - 1) / span) * 100;
          return (
            <span
              key={c.id}
              title={`${formatDayKey(c.day, timeZone)} · ${CHANNEL_LABELS[c.channel]}`}
              className="md-fade absolute size-3 -translate-x-1/2 rounded-full ring-2 ring-(--surface)"
              style={{
                left: `${left}%`,
                bottom: 10 + stack * 14,
                backgroundColor: CHANNEL_CHART_COLOR[c.channel],
              }}
            />
          );
        })}
        <span className="text-ink-4 absolute bottom-0 left-0 text-xs">{formatDayKey(from, timeZone)}</span>
        <span className="text-ink-4 absolute right-0 bottom-0 text-xs">{formatDayKey(to, timeZone)}</span>
      </div>
      <p className="text-ink-3 mt-4 text-center text-[13px]">
        Only {conversations.length} {conversations.length === 1 ? "conversation" : "conversations"} so
        far. The trend chart appears after 5.
      </p>
    </div>
  );
}

/**
 * A brand-new clinic sees what the chart will look like, clearly labelled as
 * a sample, rather than an empty box.
 */
export function SampleVolume({ height }: { height: number }) {
  const points = [3, 5, 4, 7, 6, 9, 8, 11, 9, 12, 10, 13];
  const max = 14;
  const line = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (points.length - 1)) * 100},${100 - (v / max) * 100}`)
    .join(" ");
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="size-full opacity-30" aria-hidden="true">
        <path d={`${line} L100,100 L0,100 Z`} fill="var(--whatsapp-soft)" />
        <path d={line} fill="none" stroke="var(--whatsapp)" strokeWidth={1.75} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="bg-sunken text-ink-3 absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium">
        Sample
      </span>
      <p className="text-ink-2 absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm">
        Daily conversations will show here once the agent starts answering.
      </p>
    </div>
  );
}
