import { PageShell } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART_HEIGHT } from "@/components/analytics/chart-frame";

/**
 * Mirrors the real page: one emphasised KPI beside five, then the chart grid.
 * Chart blocks use the same CHART_HEIGHT constant the charts do, so nothing
 * shifts when the data lands.
 */
export default function AnalyticsLoading() {
  return (
    <PageShell>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Skeleton className="h-7 w-36" />
          <Skeleton className="mt-2 h-4 w-80" />
        </div>
        <Skeleton className="h-8 w-80" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <KpiSkeleton tall />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <KpiSkeleton key={index} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <ChartSkeleton className="lg:col-span-2" />
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
        <ChartSkeleton />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <TableSkeleton />
        <TableSkeleton />
      </div>
    </PageShell>
  );
}

function KpiSkeleton({ tall = false }: { tall?: boolean }) {
  return (
    <Card>
      <CardContent className="px-4 py-3.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className={tall ? "mt-2 h-9 w-24" : "mt-2 h-7 w-20"} />
        <Skeleton className="mt-2 h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={`gap-0 py-0 ${className ?? ""}`}>
      <CardContent className="px-4 py-4">
        <Skeleton className="h-3.5 w-36" />
        <Skeleton
          className="mt-3 w-full"
          style={{ height: CHART_HEIGHT }}
        />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="px-4 py-4">
        <Skeleton className="h-3.5 w-32" />
        <div className="mt-3 flex flex-col gap-2.5">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-4 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
