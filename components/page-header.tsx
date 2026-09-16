import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared page heading. Keeps the title, the one-line explanation and the
 * page-level controls in the same place on every screen, which is what makes
 * the console feel like one tool rather than three.
 */
export function PageHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        )}
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

/** Standard page frame: max width, gutters, and consistent vertical rhythm. */
export function PageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <main
      className={cn(
        "mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-8 sm:py-8",
        className,
      )}
    >
      {children}
    </main>
  );
}
