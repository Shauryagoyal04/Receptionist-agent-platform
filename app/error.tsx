"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Root error boundary.
 *
 * A route's own error.tsx only catches errors thrown by its children, not by
 * the layout that renders it — so a failure inside the dashboard layout
 * (a missing service account key, for instance) would otherwise reach the
 * browser as a blank page. This catches those.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col justify-center px-6 py-16">
      <div className="flex flex-col items-start gap-4">
        <span className="bg-status-escalated-tint text-status-escalated flex size-10 items-center justify-center rounded-md">
          <TriangleAlert className="size-5" />
        </span>

        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            The console couldn&apos;t start
          </h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            This usually means the server is missing its Firebase credentials.
            Check that <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">.env.local</code>{" "}
            exists and that every value in{" "}
            <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">.env.example</code>{" "}
            is filled in, then restart the server.
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

        <Button onClick={retry}>Try again</Button>
      </div>
    </main>
  );
}
