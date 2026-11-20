import { PageHeader, PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the real list: icon well, name and description, badge, count. */
export default function DataSettingsLoading() {
  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Data settings"
      />
      <Skeleton className="mt-3 h-4 w-72" />
      {[3, 2].map((rows, section) => (
        <div key={section} className="mt-10" aria-hidden="true">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-2 mb-4 h-3.5 w-80" />
          <div className="bg-surface border-line overflow-hidden rounded-xl border">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="border-line flex h-[72px] items-center gap-4 border-t px-5 first:border-t-0">
                <Skeleton className="size-10 rounded-[10px]" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="mt-2 h-3 w-64" />
                </div>
                <Skeleton className="hidden h-6 w-28 rounded-full sm:block" />
                <Skeleton className="hidden h-3.5 w-16 md:block" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageShell>
  );
}
