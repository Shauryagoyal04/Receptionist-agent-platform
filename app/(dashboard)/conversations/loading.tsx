import { PageHeader, PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches the real page: the real header, the toolbar on top of the table,
 * and a full page of 48px rows — so nothing jumps when the data arrives.
 */
export default function ConversationsLoading() {
  return (
    <PageShell>
      <PageHeader
        title="Conversations"
      />

      <section
        aria-busy="true"
        aria-label="Loading conversations"
        className="bg-surface border-line mt-6 overflow-hidden rounded-xl border"
      >
        <div className="border-line flex flex-col gap-2.5 border-b p-3 lg:flex-row lg:justify-between">
          <Skeleton className="h-9 w-full rounded-[10px] lg:max-w-sm" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-72 rounded-[10px]" />
            <Skeleton className="h-9 w-28 rounded-[10px]" />
          </div>
        </div>
        <div className="bg-sunken border-line flex h-10 items-center gap-6 border-b px-4">
          {["w-16", "w-20", "w-24", "w-16", "w-14", "w-12", "w-14"].map((width, index) => (
            <Skeleton key={index} className={`h-3 ${width}`} />
          ))}
        </div>
        {Array.from({ length: 12 }).map((_, index) => (
          <div key={index} className="border-line flex h-14 items-center gap-6 border-b px-4 last:border-b-0">
            <div className="flex w-[220px] items-center gap-3">
              <Skeleton className="size-8 rounded-lg" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="ml-auto h-3.5 w-8" />
            <Skeleton className="h-3.5 w-10" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-3.5 w-16" />
          </div>
        ))}
      </section>
    </PageShell>
  );
}
