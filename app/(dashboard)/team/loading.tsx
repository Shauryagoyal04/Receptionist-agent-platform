import { PageHeader, PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the people table: avatar, name and email, role, dates. */
export default function TeamLoading() {
  return (
    <PageShell>
      <PageHeader
        title="Team"
      />
      <div
        className="bg-surface border-line mt-6 overflow-hidden rounded-xl border"
        aria-busy="true"
        aria-label="Loading team"
      >
        <div className="px-5 pt-5 pb-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
        </div>
        <Skeleton className="h-10 rounded-none" />
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-line flex h-16 items-center gap-3 border-t px-4">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-1.5 h-3.5 w-52" />
            </div>
            <Skeleton className="h-9 w-40 rounded-[10px]" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}
