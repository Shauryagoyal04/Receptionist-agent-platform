import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Previous / Next only.
 *
 * There are no page numbers because Firestore cannot count a filtered result
 * set cheaply, and a "Page 4 of 37" that costs a full scan to render is worse
 * than not having it. "Previous" walks a stack of cursors carried in the URL,
 * so going back lands on exactly the rows that were shown before rather than
 * re-running a query that may have shifted.
 */
export function Pagination({
  previousHref,
  nextHref,
  rangeStart,
  rangeEnd,
}: {
  previousHref: string | null;
  nextHref: string | null;
  rangeStart: number;
  rangeEnd: number;
}) {
  if (previousHref === null && nextHref === null) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-3 border-t px-4 py-3"
    >
      <p className="text-muted-foreground text-xs" aria-live="polite">
        Showing <span className="tabular font-medium">{rangeStart}</span>–
        <span className="tabular font-medium">{rangeEnd}</span>
      </p>

      <div className="flex items-center gap-2">
        {previousHref ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={previousHref} scroll={false}>
              <ChevronLeft />
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft />
            Previous
          </Button>
        )}

        {nextHref ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={nextHref} scroll={false}>
              Next
              <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Next
            <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}
