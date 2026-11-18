import { PageShell } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the detail layout — header with channel well, transcript column
 * with message rows, and a 320px rail of cards — so the page does not
 * reflow when the conversation arrives.
 */
export default function ConversationDetailLoading() {
  return (
    <PageShell>
      <Skeleton className="h-8 w-36 rounded-[9px]" />

      <div className="mt-3 flex items-start justify-between gap-3" aria-busy="true" aria-label="Loading conversation">
        <div className="flex items-start gap-4">
          <Skeleton className="size-12 rounded-xl" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-5 w-72" />
          </div>
        </div>
        <Skeleton className="h-8 w-32 rounded-[9px]" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="bg-surface border-line rounded-xl border">
          <div className="border-line border-b px-5 py-3.5">
            <Skeleton className="h-5 w-28" />
          </div>
          <div className="flex flex-col gap-5 px-5 py-5">
            {[64, 88, 48, 104, 72, 56].map((width, index) => (
              <div key={index} className="flex gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-28" />
                  <Skeleton className="h-12 rounded-xl" style={{ width: `${width}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {[5, 3, 7].map((rows, card) => (
            <div key={card} className="bg-surface border-line flex flex-col gap-2.5 rounded-xl border p-4">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: rows }).map((_, index) => (
                <Skeleton key={index} className="h-3.5 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
