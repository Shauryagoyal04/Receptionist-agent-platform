"use client";

import { useEffect, useState } from "react";
import { Check, Copy, RotateCw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/shell/brand-mark";

/**
 * Root error boundary.
 *
 * A route's own error.tsx only catches errors thrown by its children, not by
 * the layout that renders it — so a failure inside the dashboard layout
 * (a missing setting, or the database being unreachable) would otherwise
 * reach the browser as a blank page. This catches those.
 *
 * Staff see what to do next, not the raw error; "Copy details" carries the
 * message and digest to whoever runs the server, along with the usual causes.
 */
export default function RootError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    console.error("[app] unhandled error", error);
  }, [error]);

  function copy() {
    const details = [
      `Page: ${window.location.pathname}`,
      `Time: ${new Date().toISOString()}`,
      `Message: ${error.message}`,
      error.digest ? `Digest: ${error.digest}` : null,
      "Usual causes: MongoDB unreachable, or MONGODB_URI / AUTH_SECRET missing from .env.local.",
    ]
      .filter(Boolean)
      .join("\n");
    void navigator.clipboard?.writeText(details).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    });
  }

  return (
    <main className="bg-app flex min-h-svh w-full flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <BrandMark size="lg" className="mb-8" />
        <div className="bg-surface border-line flex flex-col items-start gap-5 rounded-2xl border p-6 sm:p-8">
          <span className="bg-danger-soft text-danger flex size-11 items-center justify-center rounded-[10px]">
            <TriangleAlert className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-ink text-2xl leading-8 font-semibold">The console couldn&apos;t start</h1>
            <p className="text-ink-2 mt-2 text-[15px] leading-[22px]">
              The server couldn&apos;t reach its database or is missing a setting. Try again in a
              moment; if it still won&apos;t start, copy the details for whoever runs the server.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={retry}>
              <RotateCw />
              Try again
            </Button>
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="text-booked" /> : <Copy />}
              {copied ? "Copied" : "Copy details"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
