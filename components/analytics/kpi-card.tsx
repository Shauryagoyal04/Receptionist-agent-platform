import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/lib/analytics/aggregate";

/**
 * One KPI with its change against the immediately preceding period.
 *
 * The change is colored by whether the movement is good *for that metric*,
 * not by its sign: escalations falling is green, handling time rising is red.
 * Colouring every increase green is the standard way these dashboards end up
 * lying to the person reading them.
 */
export function KpiCard({
  kpi,
  emphasis = false,
  periodLabel,
}: {
  kpi: Kpi;
  emphasis?: boolean;
  periodLabel: string;
}) {
  return (
    <Card className={cn(emphasis && "border-status-booked/40 bg-status-booked-tint/40")}>
      <CardContent className="px-4 py-3.5">
        <p className="text-muted-foreground text-xs">{kpi.label}</p>
        <p
          className={cn(
            "tabular mt-1 font-semibold",
            emphasis ? "text-status-booked text-3xl" : "text-2xl",
          )}
        >
          {kpi.value}
        </p>
        <Delta kpi={kpi} periodLabel={periodLabel} />
      </CardContent>
    </Card>
  );
}

function Delta({ kpi, periodLabel }: { kpi: Kpi; periodLabel: string }) {
  if (kpi.delta === null) {
    return (
      <p className="text-muted-foreground mt-1.5 text-xs">
        No {periodLabel} to compare with
      </p>
    );
  }

  // Treat sub-0.5% movement as flat: a 0.2% wobble is noise, and an arrow
  // next to it invites someone to explain a change that did not happen.
  const flat = Math.abs(kpi.delta) < 0.005;
  const rising = kpi.delta > 0;
  const good = rising === kpi.increaseIsGood;

  const Icon = flat ? Minus : rising ? ArrowUp : ArrowDown;

  return (
    <p
      className={cn(
        "mt-1.5 flex items-center gap-1 text-xs",
        flat
          ? "text-muted-foreground"
          : good
            ? "text-status-booked"
            : "text-status-escalated",
      )}
    >
      <Icon className="size-3 shrink-0" />
      <span className="tabular font-mono">
        {flat ? "0%" : `${rising ? "+" : ""}${(kpi.delta * 100).toFixed(1)}%`}
      </span>
      <span className="text-muted-foreground">vs {periodLabel}</span>
    </p>
  );
}
