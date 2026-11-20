import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Shared page heading. Keeps the title and the page-level controls in the same place on every screen, which is what makes
 * the console feel like one tool rather than three.
 */
export function PageHeader({
  title,
  children,
  className,
}: {
  title: string;
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
        <h1 className="text-ink text-2xl leading-8 font-semibold sm:text-[28px] sm:leading-[34px]">
          {title}
        </h1>
      </div>
      {children && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Standard page frame: 1280px max, left-aligned beside the sidebar rather
 * than centred in a sea of background.
 */
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
        "w-full max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8",
        className,
      )}
    >
      {children}
    </main>
  );
}
