import { PageShell } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches the real table's footprint — eight columns and a full page of rows
 * — so the layout does not jump when the data arrives.
 */
export default function ConversationsLoading() {
  return (
    <PageShell>
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-80" />

      <Card className="mt-6 overflow-hidden py-0">
        <div className="divide-y">
          <div className="flex items-center gap-4 px-4 py-2.5">
            {["w-24", "w-16", "w-20", "w-16", "w-14", "w-14", "w-16", "w-14"].map(
              (width, index) => (
                <Skeleton key={index} className={`h-3.5 ${width}`} />
              ),
            )}
          </div>
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3">
              <div className="flex w-[180px] flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3.5 w-8" />
              <Skeleton className="h-3.5 w-10" />
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
