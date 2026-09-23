"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { CHART_HEIGHT } from "@/components/analytics/chart-frame";
import { formatInZone } from "@/lib/time";
import {
  CHANNEL_LABELS,
  INTENT_LABELS,
  type Channel,
  type IntentId,
} from "@/lib/types";
import type { DayBucket, CountShare } from "@/lib/analytics/aggregate";

/*
 * The Recharts layer.
 *
 * These are the only Client Components on the analytics page — the page
 * itself, its aggregation and its tables all stay on the server. Colors come
 * from the same CSS custom properties the rest of the UI uses, so a series
 * keeps its meaning and follows dark mode without a second palette.
 */

const AXIS = {
  stroke: "var(--border)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

const GRID = {
  stroke: "var(--border)",
  strokeDasharray: "2 4",
  vertical: false,
} as const;

function TooltipShell({
  label,
  rows,
}: {
  label: string;
  rows: Array<{ key: string; label: string; value: string; color?: string }>;
}) {
  return (
    <div className="bg-popover rounded-md border px-2.5 py-2 text-xs shadow-md">
      <p className="mb-1 font-medium">{label}</p>
      {rows.map((row) => (
        <p key={row.key} className="flex items-center gap-1.5">
          {row.color && (
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
          )}
          <span className="text-muted-foreground">{row.label}</span>
          <span className="tabular ml-auto font-mono font-medium">
            {row.value}
          </span>
        </p>
      ))}
    </div>
  );
}

function dayLabel(day: string, timeZone: string): string {
  return formatInZone(`${day}T12:00:00.000Z`, timeZone, {
    day: "numeric",
    month: "short",
  });
}

/* ------------------------------------------------------------------ */

/**
 * Volume over time with escalations as a second series, so a spike in load
 * and a spike in failure can be compared on one axis rather than by flicking
 * between two charts.
 */
export function VolumeChart({
  days,
  timeZone,
  escalationLabel,
}: {
  days: DayBucket[];
  timeZone: string;
  /** "Escalated" or "Asked for a human", depending on the deployment. */
  escalationLabel: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <AreaChart data={days} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="volume-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--status-booked)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--status-booked)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="day"
          {...AXIS}
          minTickGap={24}
          tickFormatter={(day: string) => dayLabel(day, timeZone)}
        />
        <YAxis {...AXIS} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const bucket = payload[0].payload as DayBucket;
            return (
              <TooltipShell
                label={dayLabel(bucket.day, timeZone)}
                rows={[
                  {
                    key: "total",
                    label: "Conversations",
                    value: String(bucket.total),
                    color: "var(--status-booked)",
                  },
                  {
                    key: "escalated",
                    label: escalationLabel,
                    value: String(bucket.escalated),
                    color: "var(--status-escalated)",
                  },
                ]}
              />
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="total"
          stroke="var(--status-booked)"
          strokeWidth={1.5}
          fill="url(#volume-fill)"
        />
        <Area
          type="monotone"
          dataKey="escalated"
          stroke="var(--status-escalated)"
          strokeWidth={1.5}
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Intent distribution, sorted descending with counts at the bar end. */
export function IntentChart({ data }: { data: CountShare<IntentId>[] }) {
  const rows = data
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({ ...entry, label: INTENT_LABELS[entry.key] }));

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart
        data={rows}
        layout="vertical"
        margin={{ top: 0, right: 28, bottom: 0, left: 0 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          {...AXIS}
          width={120}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { label: string; count: number; share: number };
            return (
              <TooltipShell
                label={row.label}
                rows={[
                  { key: "count", label: "Conversations", value: String(row.count) },
                  { key: "share", label: "Share", value: `${(row.share * 100).toFixed(1)}%` },
                ]}
              />
            );
          }}
        />
        <Bar
          dataKey="count"
          fill="var(--status-booked)"
          radius={[0, 3, 3, 0]}
          barSize={14}
          label={{
            position: "right",
            fontSize: 11,
            fill: "var(--muted-foreground)",
          }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Conversations per hour on the clinic's wall clock — the chart that actually
 * informs staffing, which is why it is bucketed in local time rather than UTC.
 */
export function HoursChart({ hours }: { hours: number[] }) {
  const rows = hours.map((count, hour) => ({ hour, count }));
  const peak = Math.max(...hours);

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="hour"
          {...AXIS}
          interval={2}
          tickFormatter={(hour: number) => `${String(hour).padStart(2, "0")}`}
        />
        <YAxis {...AXIS} allowDecimals={false} width={40} />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as { hour: number; count: number };
            return (
              <TooltipShell
                label={`${String(row.hour).padStart(2, "0")}:00–${String(row.hour).padStart(2, "0")}:59`}
                rows={[{ key: "count", label: "Conversations", value: String(row.count) }]}
              />
            );
          }}
        />
        <Bar dataKey="count" radius={[3, 3, 0, 0]}>
          {rows.map((row) => (
            <Cell
              key={row.hour}
              // The busiest hours are the point of the chart, so they get the
              // full-strength color and the quiet ones recede.
              fill={
                row.count === peak && peak > 0
                  ? "var(--status-booked)"
                  : "color-mix(in oklab, var(--status-booked) 45%, var(--background))"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Share of conversations ending in negative sentiment, per day. */
export function SentimentChart({
  days,
  timeZone,
}: {
  days: DayBucket[];
  timeZone: string;
}) {
  const rows = days.map((bucket) => ({
    day: bucket.day,
    share: bucket.total > 0 ? (bucket.negative / bucket.total) * 100 : 0,
    negative: bucket.negative,
    total: bucket.total,
  }));

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
        <CartesianGrid {...GRID} />
        <XAxis
          dataKey="day"
          {...AXIS}
          minTickGap={24}
          tickFormatter={(day: string) => dayLabel(day, timeZone)}
        />
        <YAxis
          {...AXIS}
          width={40}
          unit="%"
          domain={[0, (max: number) => Math.max(10, Math.ceil(max / 10) * 10)]}
        />
        <Tooltip
          cursor={{ stroke: "var(--border)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as {
              day: string;
              share: number;
              negative: number;
              total: number;
            };
            return (
              <TooltipShell
                label={dayLabel(row.day, timeZone)}
                rows={[
                  { key: "share", label: "Negative", value: `${row.share.toFixed(1)}%` },
                  {
                    key: "count",
                    label: "Conversations",
                    value: `${row.negative} of ${row.total}`,
                  },
                ]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="share"
          stroke="var(--status-escalated)"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Channel split as three compact stat rows rather than a chart. */
export function ChannelSplit({ data }: { data: CountShare<Channel>[] }) {
  const rows = data.filter((entry) => entry.count > 0);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((entry) => (
        <li key={entry.key}>
          <div className="flex items-baseline justify-between text-sm">
            <span>{CHANNEL_LABELS[entry.key]}</span>
            <span className="tabular text-muted-foreground font-mono text-xs">
              {entry.count} · {(entry.share * 100).toFixed(0)}%
            </span>
          </div>
          <div className="bg-muted mt-1.5 h-1.5 overflow-hidden rounded-full">
            <div
              className="bg-status-booked h-full rounded-full"
              style={{ width: `${entry.share * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
