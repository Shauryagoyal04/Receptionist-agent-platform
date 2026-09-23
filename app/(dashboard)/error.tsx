"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the dashboard.
 *
 * In Next.js 16 the recovery callback is named `retry` (it was `reset` in 15).
 * The message says what broke and what to try, per the states requirement in
 * §3 — a bare "Something went wrong" leaves a receptionist with no next step.
 */
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="flex flex-col items-start gap-4">
        <span className="bg-status-escalated-tint text-status-escalated flex size-10 items-center justify-center rounded-md">
          <TriangleAlert className="size-5" />
        </span>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            This page couldn&apos;t load
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            The console reached the database but the request didn&apos;t come
            back cleanly. This is usually a dropped connection, or an IP that
            is no longer on the Atlas access list.
          </p>
        </div>

        <div className="bg-muted/50 w-full rounded-md border p-3">
          <p className="font-mono text-xs break-words">{error.message}</p>
          {error.digest && (
            <p className="text-muted-foreground mt-1.5 font-mono text-xs">
              digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={retry}>Try again</Button>
          <Button variant="outline" asChild>
            <a href="/analytics">Back to analytics</a>
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          If this keeps happening, check the server logs, and confirm the
          indexes exist by running <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">npm run db:setup</code>.
        </p>
      </div>
    </main>
  );
}
