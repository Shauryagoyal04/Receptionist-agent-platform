import { PageShell } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EscalationsLoading() {
  return (
    <PageShell>
      <Skeleton className="h-7 w-40" />
      <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      <div className="mt-5 flex gap-1">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index} className="py-0">
            <CardContent className="flex flex-col gap-2 py-4">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-full max-w-md" />
            </CardContent>
          </Card>
        ))}
      </div>
    </PageShell>
  );
}
