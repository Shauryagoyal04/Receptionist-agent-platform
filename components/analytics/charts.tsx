"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const HOURS_HEIGHT = 180;

function hourLabel(hour: number): string {
  const suffix = hour < 12 ? "AM" : "PM";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${suffix}`;
}

/**
 * Conversations by hour on the clinic's wall clock: when the desk is busiest,
 * which is what staffing follows. The peak hours are full petrol (the agent
 * at work); quieter hours recede to the soft tint.
 */
export function HoursChart({ hours }: { hours: number[] }) {
  // Trim the hours nobody contacts the clinic, so 3 AM doesn't take a column.
  const active = hours.map((count, hour) => ({ hour, count })).filter((r) => r.count > 0);
  const first = active.length ? Math.max(0, Math.min(...active.map((r) => r.hour)) - 1) : 8;
  const last = active.length ? Math.min(23, Math.max(...active.map((r) => r.hour)) + 1) : 20;
  const rows = hours.slice(first, last + 1).map((count, i) => ({ hour: first + i, count }));
  const sorted = [...hours].sort((a, b) => b - a);
  const peakCut = sorted[2] ?? 0;

  return (
    <ResponsiveContainer width="100%" height={HOURS_HEIGHT}>
      <BarChart data={rows} margin={{ top: 4, right: 0, bottom: 0, left: -24 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="2 4" />
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={16}
          tick={{ fontSize: 12, fill: "var(--ink-4)" }}
          tickFormatter={(hour: number) => hourLabel(hour).replace(" ", "").toLowerCase()}
        />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={40} tickCount={4} tick={{ fontSize: 12, fill: "var(--ink-4)" }} />
        <Tooltip
          cursor={{ fill: "var(--bg-sunken)", opacity: 0.6 }}
          content={({ active: isActive, payload }) => {
            if (!isActive || !payload?.length) return null;
            const row = payload[0].payload as { hour: number; count: number };
            return (
              <div className="bg-surface border-line rounded-[10px] border px-3 py-2 text-[13px] shadow-(--shadow-pop)">
                <p className="text-ink font-medium">
                  {hourLabel(row.hour)} – {hourLabel((row.hour + 1) % 24)}
                </p>
                <p className="text-ink-2 mt-0.5">
                  <span className="tnum text-ink font-medium">{row.count}</span>{" "}
                  {row.count === 1 ? "conversation" : "conversations"}
                </p>
              </div>
            );
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} animationDuration={600} animationEasing="ease-out">
          {rows.map((row) => (
            <Cell
              key={row.hour}
              fill={row.count > 0 && row.count >= peakCut ? "var(--agent)" : "color-mix(in srgb, var(--agent) 28%, var(--surface))"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
