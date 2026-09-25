import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared frame for every chart.
 *
 * Owns the title, the empty state, the fixed height and the chart's text
 * alternative. The height is set here rather than inside each chart so the
 * loading skeleton can declare the same number and the page does not jump
 * when data arrives.
 */
/*
 * Chart height.
 *
 * Shared with the loading skeleton so the page does not jump, and kept
 * deliberately compact: five charts at 240px each pushed the analytics page
 * well past two screens on a laptop.
 */
export const CHART_HEIGHT = 200;

export type ChartTableRow = { label: string; value: string };

export function ChartFrame({
  title,
  description,
  isEmpty,
  emptyLabel = "No conversations in this range",
  tableCaption,
  tableRows,
  className,
  children,
}: {
  title: string;
  description?: string;
  isEmpty: boolean;
  emptyLabel?: string;
  /** Describes what the equivalent table contains. */
  tableCaption?: string;
  /**
   * The same figures the chart draws, as text.
   *
   * An SVG plot is unreadable to a screen reader, and `aria-label` on a chart
   * can only ever summarize it. A real table carries every value, so the
   * page is usable without seeing it — which is also what makes the numbers
   * copyable.
   */
  tableRows?: ChartTableRow[];
  className?: string;
  children: React.ReactNode;
}) {
  return (
    // `min-w-0` matters: without it a grid item is min-width:auto and the
    // Recharts SVG can refuse to shrink, overflowing the page sideways.
    <Card className={cn("min-w-0 gap-0 py-0", className)}>
      <CardHeader className="px-4 pt-4 pb-0">
        <div>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && (
            <p className="text-muted-foreground mt-0.5 text-xs">{description}</p>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-4">
        {isEmpty ? (
          // Never render an axis with no data — an empty grid reads as a
          // broken chart rather than as "nothing happened".
          <div
            style={{ height: CHART_HEIGHT }}
            className="text-muted-foreground flex items-center justify-center rounded-md border border-dashed text-sm"
          >
            {emptyLabel}
          </div>
        ) : (
          <>
            {/* The plot itself carries no information for assistive tech; the
                table below is the accessible copy. */}
            <div aria-hidden="true">{children}</div>
            {tableRows && tableRows.length > 0 && (
              <table className="sr-only">
                <caption>{tableCaption ?? title}</caption>
                <thead>
                  <tr>
                    <th scope="col">Label</th>
                    <th scope="col">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.label}>
                      <th scope="row">{row.label}</th>
                      <td>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
