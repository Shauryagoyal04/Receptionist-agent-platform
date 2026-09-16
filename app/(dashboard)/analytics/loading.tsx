import { PageShell } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <PageShell>
      <Skeleton className="h-7 w-36" />
      <Skeleton className="mt-2 h-4 w-72" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="py-4">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="mt-2 h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
