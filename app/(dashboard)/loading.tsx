import { Skeleton } from "@/components/ui/skeleton";

/**
 * Fallback for dashboard routes that have not declared their own skeleton.
 * Each page ships a loading.tsx matching its real layout, so this only shows
 * during a segment transition.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-72" />
      <Skeleton className="mt-6 h-64 w-full" />
    </main>
  );
}
