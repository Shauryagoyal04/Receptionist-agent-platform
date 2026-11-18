import Link from "next/link";
import { Lock, type LucideIcon } from "lucide-react";

import { PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const TONE_WELL = {
  agent: "bg-agent-soft text-agent",
  booked: "bg-booked-soft text-booked",
  none: "bg-none-soft text-none-text",
} as const;

/**
 * An empty region: a small icon in a meaning-coloured well, what will appear
 * here, and how to make it appear. `none` is for "nothing matched", where
 * there's nothing to set up.
 */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  tone = "agent",
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: keyof typeof TONE_WELL;
}) {
  return (
    <div className="md-fade flex flex-col items-center gap-3 px-6 py-14 text-center">
      <span className={cn("flex size-11 items-center justify-center rounded-xl", TONE_WELL[tone])}>
        <Icon className="size-5" strokeWidth={1.75} aria-hidden="true" />
      </span>
      <div>
        <p className="text-ink text-[15px] font-medium">{title}</p>
        {children && (
          <div className="text-ink-3 mx-auto mt-1 max-w-md text-[13px] leading-[18px]">{children}</div>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/** Shown to staff who open an admin-only page. */
export function AdminOnly() {
  return (
    <PageShell>
      <Card>
        <EmptyState
          icon={Lock}
          tone="none"
          title="Admins only"
          action={
            <Button variant="outline" asChild>
              <Link href="/analytics">Back to analytics</Link>
            </Button>
          }
        >
          Pages and fields are configured by clinic admins. Ask an admin if
          something needs adding.
        </EmptyState>
      </Card>
    </PageShell>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Skeleton className="h-8 w-44" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <Skeleton className="h-9 w-32 rounded-[10px]" />
    </div>
  );
}

export function ListSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <PageShell>
      <HeaderSkeleton />
      <div className="bg-surface border-line mt-6 overflow-hidden rounded-xl border">
        <div className="border-line flex gap-2 border-b p-3">
          <Skeleton className="h-9 w-72 rounded-[10px]" />
          <Skeleton className="h-9 w-40 rounded-[10px]" />
        </div>
        <div className="bg-sunken h-10" />
        <div className="divide-line divide-y">
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex h-12 items-center gap-6 px-4">
              {Array.from({ length: columns }).map((__, col) => (
                <Skeleton key={col} className={col === 0 ? "h-3.5 w-40" : "h-3.5 w-20"} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}

/** Loading state for card-grid lists (Doctors). */
export function CardGridSkeleton() {
  return (
    <PageShell>
      <HeaderSkeleton />
      <Skeleton className="mt-6 h-[58px] w-full rounded-xl" />
      <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-surface border-line rounded-xl border p-5">
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3.5 w-24" />
              </div>
            </div>
            <Skeleton className="mt-5 h-6 w-40" />
            <Skeleton className="mt-3 h-3.5 w-48" />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function FormSkeleton() {
  return (
    <PageShell>
      <HeaderSkeleton />
      <div className="mt-6 flex max-w-[720px] flex-col gap-6">
        {[6, 3].map((count, card) => (
          <div key={card} className="bg-surface border-line rounded-xl border p-6">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="mt-2 h-3.5 w-64" />
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              {Array.from({ length: count }).map((_, index) => (
                <div key={index} className="flex flex-col gap-2">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-10 w-full rounded-[10px]" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
