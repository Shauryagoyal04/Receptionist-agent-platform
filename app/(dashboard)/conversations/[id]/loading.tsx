import { PageShell } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Mirrors the detail layout — transcript column plus a 320px rail — so the
 * page does not reflow when the conversation arrives.
 */
export default function ConversationDetailLoading() {
  return (
    <PageShell>
      <Skeleton className="h-8 w-44" />

      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-52" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardContent className="flex flex-col gap-3 py-4">
            {[72, 96, 56, 120, 64, 88].map((height, index) => (
              <Skeleton key={index} style={{ height }} className="w-full" />
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 py-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-12 w-full" />
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-4 w-full" />
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 py-4">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </PageShell>
  );
}
