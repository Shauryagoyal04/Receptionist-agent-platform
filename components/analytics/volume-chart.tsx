"use client";

import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { VOLUME_HEIGHT, formatDayKey, formatDayKeyLong } from "@/components/analytics/format";
import { CHANNEL_LABELS, type Channel } from "@/lib/types";
import type { DayBucket } from "@/lib/analytics/aggregate";

const AXIS = {
  tickLine: false,
  axisLine: false,
  tick: { fontSize: 12, fill: "var(--ink-4)" },
} as const;

type Row = DayBucket & { closed: boolean; band: number };

/**
 * Conversations per day, stacked by channel in the channel colours, with
 * "asked for a human" as amber dots on top. Days the clinic is closed are
 * shaded, and today gets a short tick.
 */
export function VolumeChart({
  days,
  channels,
  closedWeekdays,
  today,
  timeZone,
  humanLabel,
}: {
  days: DayBucket[];
  /** Channels to stack, in order from the baseline up. */
  channels: Channel[];
  closedWeekdays: number[];
  today: string;
  timeZone: string;
  humanLabel: string;
}) {
  const peak = Math.max(1, ...days.map((d) => d.total));
  // The band is a full-height bar behind the areas on closed days.
  const top = niceCeil(peak);
  const closed = new Set(closedWeekdays);
  const rows: Row[] = days.map((d) => {
    const isClosed = closed.has(new Date(`${d.day}T12:00:00.000Z`).getUTCDay());
    return { ...d, closed: isClosed, band: isClosed ? top : 0 };
  });
  const showToday = days.some((d) => d.day === today);

  return (
    <ResponsiveContainer width="100%" height={VOLUME_HEIGHT}>
      <ComposedChart data={rows} margin={{ top: 16, right: 8, bottom: 0, left: -16 }} barCategoryGap={0}>
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
        <XAxis
          dataKey="day"
          {...AXIS}
          minTickGap={28}
          tickFormatter={(day: string) => formatDayKey(day, timeZone)}
        />
        <YAxis {...AXIS} allowDecimals={false} width={40} domain={[0, top]} tickCount={4} />

        <Bar dataKey="band" fill="var(--bg-sunken)" isAnimationActive={false} legendType="none" />

        {channels.map((channel) => (
          <Area
            key={channel}
            type="monotone"
            dataKey={channel}
            stackId="volume"
            stroke={`var(--${channelToken(channel)})`}
            strokeWidth={1.75}
            fill={`var(--${channelToken(channel)}-soft)`}
            fillOpacity={0.9}
            animationDuration={600}
            animationEasing="ease-out"
            activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)" }}
          />
        ))}

        <Line
          dataKey="escalated"
          stroke="none"
          isAnimationActive={false}
          activeDot={false}
          dot={(props: { cx?: number; cy?: number; payload?: Row; index?: number }) => {
            const { cx, cy, payload, index } = props;
            if (!payload || payload.escalated === 0 || cx === undefined || cy === undefined) {
              return <g key={`h-${index}`} />;
            }
            return (
              <circle
                key={`h-${index}`}
                cx={cx}
                cy={cy}
                r={3.5}
                fill="var(--human)"
                stroke="var(--surface)"
                strokeWidth={1.5}
              />
            );
          }}
        />

        {showToday && (
          <ReferenceLine
            x={today}
            stroke="var(--ink-4)"
            strokeDasharray="2 3"
            label={{ value: "Today", position: "top", fontSize: 11, fill: "var(--ink-3)" }}
          />
        )}

        <Tooltip
          cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as Row;
            return (
              <div className="bg-surface border-line min-w-44 rounded-[10px] border px-3 py-2.5 text-[13px] shadow-(--shadow-pop)">
                <p className="text-ink mb-1.5 font-medium">{formatDayKeyLong(row.day, timeZone)}</p>
                {channels.map((channel) => (
                  <TooltipRow
                    key={channel}
                    color={`var(--${channelToken(channel)})`}
                    label={CHANNEL_LABELS[channel]}
                    value={row[channel]}
                  />
                ))}
                <TooltipRow color="var(--human)" label={humanLabel} value={row.escalated} />
                {row.total === 0 && (
                  <p className="text-ink-3 mt-1.5 text-xs">
                    {row.closed ? "No chats: clinic closed" : "No chats this day"}
                  </p>
                )}
              </div>
            );
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

function TooltipRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-ink-2">{label}</span>
      <span className="tnum text-ink ml-auto pl-4 font-medium">{value}</span>
    </p>
  );
}

function channelToken(channel: Channel): string {
  return channel === "web_chat" ? "agent" : channel;
}

/** A round axis maximum on whole-number ticks: 7 → 8, 23 → 30, 140 → 150. */
function niceCeil(value: number): number {
  if (value <= 4) return 4;
  const rough = value / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const step = [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ?? rough;
  return Math.ceil(value / step) * step;
}
