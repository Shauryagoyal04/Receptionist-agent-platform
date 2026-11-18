"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for the dashboard.
 *
 * In Next.js 16 the recovery callback is named `retry` (it was `reset` in 15).
 * Staff get what broke and what to try, never a raw error: the message and
 * digest are logged, and "Copy details" puts them on the clipboard for
 * whoever supports the console.
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
    <main className="w-full max-w-[1280px] px-4 py-10 sm:px-8 sm:py-16">
      <div className="bg-surface border-line flex max-w-xl flex-col items-start gap-5 rounded-2xl border p-6 sm:p-8">
        <span className="bg-danger-soft text-danger flex size-11 items-center justify-center rounded-[10px]">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>

        <div>
          <h1 className="text-ink text-2xl leading-8 font-semibold">This page couldn&apos;t load</h1>
          <p className="text-ink-2 mt-2 text-[15px] leading-[22px]">
            The console couldn&apos;t get this page&apos;s data just now. Trying again usually fixes
            it. The rest of the console still works.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={retry}>
            <RotateCw />
            Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/analytics">Go to Analytics</Link>
          </Button>
          <CopyDetails error={error} />
        </div>

        <p className="text-ink-3 text-[13px]">
          If it keeps happening, send the copied details to whoever looks after the console.
        </p>
      </div>
    </main>
  );
}

function CopyDetails({ error }: { error: Error & { digest?: string } }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={() => {
        const details = [
          `Page: ${window.location.pathname}`,
          `Time: ${new Date().toISOString()}`,
          `Message: ${error.message}`,
          error.digest ? `Digest: ${error.digest}` : null,
        ]
          .filter(Boolean)
          .join("\n");
        void navigator.clipboard?.writeText(details).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        });
      }}
    >
      {copied ? <Check className="text-booked" /> : <Copy />}
      {copied ? "Copied" : "Copy details"}
    </Button>
  );
}
