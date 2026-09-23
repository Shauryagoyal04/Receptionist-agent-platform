import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Shared frame for every chart.
 *
 * Owns the title, the empty state and the fixed height. The height is set
 * here rather than inside each chart so the loading skeleton can declare the
 * same number and the page does not jump when data arrives.
 */
export const CHART_HEIGHT = 240;

export function ChartFrame({
  title,
  description,
  isEmpty,
  emptyLabel = "No conversations in this range",
  className,
  children,
}: {
  title: string;
  description?: string;
  isEmpty: boolean;
  emptyLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("gap-0 py-0", className)}>
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
          children
        )}
      </CardContent>
    </Card>
  );
}
