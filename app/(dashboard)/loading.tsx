import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for dashboard routes that have not declared their own skeleton.
 * Each page ships a loading.tsx matching its real layout, so this only shows
 * during a segment transition.
 */
export default function DashboardLoading() {
  return (
    <main
      className="w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-44" />
      <Skeleton className="mt-2 h-4 w-72" />
      <div className="bg-surface border-line mt-6 rounded-xl border p-5">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-4 h-56 w-full" />
      </div>
    </main>
  );
}
