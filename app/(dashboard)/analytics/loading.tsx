import { PageHeader, PageShell } from "@/components/page-header";
import { VOLUME_HEIGHT } from "@/components/analytics/format";
import { cn } from "@/lib/utils";

/**
 * Skeletons shaped like the real content (a ring, number bars, sparkline
 * lines, a chart area), so nothing shifts when the data lands. The header is
 * real, not a skeleton, so the page feels instant.
 */
export default function AnalyticsLoading() {
  return (
    <PageShell>
      <PageHeader title="Analytics">
        <Bone className="h-9 w-72 rounded-[10px]" />
      </PageHeader>

      <div className="mt-6 flex flex-col gap-6" aria-busy="true" aria-label="Loading analytics">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="bg-surface border-line rounded-2xl border p-6">
            <Bone className="h-5 w-44" />
            <Bone className="mt-2 h-3.5 w-64" />
            <div className="mt-5 flex items-center gap-6">
              <div className="md-skeleton size-[120px] shrink-0 rounded-full [mask:radial-gradient(circle,transparent_50px,black_51px)]" />
              <div className="flex-1">
                <Bone className="h-4 w-full max-w-64" />
                <Bone className="mt-2 h-4 w-40" />
              </div>
            </div>
            <div className="border-line mt-6 flex flex-col gap-3 border-t pt-5">
              {[100, 80, 64].map((w) => (
                <Bone key={w} className="h-2.5" style={{ width: `${w}%` }} />
              ))}
            </div>
          </div>

          <div className="bg-surface border-line grid grid-cols-1 overflow-hidden rounded-xl border sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={cn("p-5", i > 0 && "border-line border-t", i === 1 && "sm:border-t-0", i % 2 === 1 && "sm:border-l")}
              >
                <div className="flex items-center gap-3">
                  <Bone className="size-9 rounded-[10px]" />
                  <Bone className="h-4 w-32" />
                </div>
                <Bone className="mt-3 h-8 w-20" />
                <Bone className="mt-3 h-8 w-full" />
                <Bone className="mt-2 h-3.5 w-40" />
              </div>
            ))}
          </div>
        </div>

        <PanelBone>
          <Bone className="w-full" style={{ height: VOLUME_HEIGHT }} />
        </PanelBone>

        <div className="grid gap-6 lg:grid-cols-2">
          <PanelBone>
            <Bone className="h-3 w-full rounded-full" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Bone key={i} className="h-4" />
              ))}
            </div>
          </PanelBone>
          <PanelBone>
            <div className="flex flex-col gap-3">
              {[90, 70, 52, 40, 28].map((w) => (
                <Bone key={w} className="h-2" style={{ width: `${w}%` }} />
              ))}
            </div>
          </PanelBone>
        </div>
      </div>
    </PageShell>
  );
}

function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("md-skeleton rounded-md", className)} style={style} />;
}

function PanelBone({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-surface border-line rounded-xl border p-5">
      <Bone className="h-5 w-40" />
      <Bone className="mt-2 mb-4 h-3.5 w-56" />
      {children}
    </div>
  );
}
