import Link from "next/link";
import { Lock, type LucideIcon } from "lucide-react";

import { PageShell } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Centered empty / notice state, matching the conversations empty states. */
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="font-medium">{title}</p>
        {children && (
          <div className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">{children}</div>
        )}
      </div>
      {action}
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
          title="Admins only"
          action={
            <Button variant="outline" size="sm" asChild>
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

export function ListSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <PageShell>
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Skeleton className="mt-6 h-8 w-72" />
      <Card className="mt-4 overflow-hidden py-0">
        <div className="divide-y">
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex items-center gap-6 px-4 py-3">
              {Array.from({ length: columns }).map((__, col) => (
                <Skeleton key={col} className={col === 0 ? "h-3.5 w-40" : "h-3.5 w-20"} />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}

export function FormSkeleton() {
  return (
    <PageShell className="max-w-4xl">
      <Skeleton className="h-7 w-44" />
      <Skeleton className="mt-2 h-4 w-80" />
      <Card className="mt-6">
        <div className="grid gap-4 px-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      </Card>
    </PageShell>
  );
}
