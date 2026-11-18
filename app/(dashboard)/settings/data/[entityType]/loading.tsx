import { PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the page: header, a field list, and the agent side panel. */
export default function PageSettingsLoading() {
  return (
    <PageShell>
      <div aria-busy="true" aria-label="Loading page settings">
        <Skeleton className="h-4 w-28" />
        <div className="mt-4 flex items-start gap-4">
          <Skeleton className="hidden size-12 rounded-xl sm:block" />
          <div className="flex-1">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-full max-w-md" />
          </div>
        </div>
        <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="bg-surface border-line rounded-xl border">
            <div className="border-line border-b p-5">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="mt-2 h-2 w-48 rounded-full" />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border-line flex items-center gap-4 border-t px-5 py-4 first:border-t-0">
                <Skeleton className="size-9 rounded-[10px]" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="mt-2 h-5 w-48 rounded-full" />
                </div>
                <Skeleton className="h-8 w-20" />
              </div>
            ))}
          </div>
          <div className="bg-surface border-line rounded-xl border p-5">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-3 h-6 w-32 rounded-full" />
            <Skeleton className="mt-3 h-3.5 w-full" />
            <Skeleton className="mt-2 h-3.5 w-3/4" />
          </div>
        </div>
      </div>
    </PageShell>
  );
}
