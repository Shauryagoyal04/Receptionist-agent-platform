import { PageHeader, PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the real cards: channel well, name, number, reason, actions. */
export default function EscalationsLoading() {
  return (
    <PageShell>
      <PageHeader
        title="Escalations"
      />
      <Skeleton className="mt-6 h-10 w-72 rounded-[10px]" />
      <div className="mt-5 flex flex-col gap-3" aria-busy="true" aria-label="Loading escalations">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-surface border-line flex gap-5 rounded-xl border p-5">
            <Skeleton className="size-10 shrink-0 rounded-[10px]" />
            <div className="flex-1">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-4 w-36" />
              <Skeleton className="mt-3 h-10 w-full max-w-lg rounded-[10px]" />
            </div>
            <div className="hidden w-60 flex-col gap-2 sm:flex">
              <Skeleton className="h-9 rounded-[10px]" />
              <Skeleton className="h-9 rounded-[10px]" />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
