import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Numbered pagination with an exact total.
 *
 * MongoDB counts a filtered set cheaply, so the reader can be told how many
 * conversations actually match and can jump to a page rather than clicking
 * Next repeatedly.
 *
 * Long ranges are elided around the current page so the control stays one
 * line at 375px.
 */
export function Pagination({
  page,
  pageCount,
  total,
  rangeStart,
  rangeEnd,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  total: number;
  rangeStart: number;
  rangeEnd: number;
  hrefFor: (page: number) => string;
}) {
  if (total === 0) return null;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3"
    >
      <p className="text-muted-foreground text-xs">
        <span className="tabular font-medium">{rangeStart}</span>–
        <span className="tabular font-medium">{rangeEnd}</span> of{" "}
        <span className="tabular font-medium">{total.toLocaleString("en-IN")}</span>
      </p>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <PageLink
            href={page > 1 ? hrefFor(page - 1) : null}
            label="Previous page"
          >
            <ChevronLeft />
          </PageLink>

          {pageNumbers(page, pageCount).map((entry, index) =>
            entry === "gap" ? (
              <span
                key={`gap-${index}`}
                aria-hidden="true"
                className="text-muted-foreground px-1 text-xs"
              >
                …
              </span>
            ) : (
              <Button
                key={entry}
                asChild={entry !== page}
                size="sm"
                variant={entry === page ? "secondary" : "ghost"}
                className="tabular h-8 min-w-8 px-2 font-mono text-xs"
                aria-current={entry === page ? "page" : undefined}
                disabled={entry === page}
              >
                {entry === page ? (
                  <span>{entry}</span>
                ) : (
                  <Link href={hrefFor(entry)} scroll={false}>
                    {entry}
                  </Link>
                )}
              </Button>
            ),
          )}

          <PageLink
            href={page < pageCount ? hrefFor(page + 1) : null}
            label="Next page"
          >
            <ChevronRight />
          </PageLink>
        </div>
      )}
    </nav>
  );
}

function PageLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: React.ReactNode;
}) {
  if (!href) {
    return (
      <Button
        size="sm"
        variant="ghost"
        className="size-8 p-0"
        disabled
        aria-label={label}
      >
        {children}
      </Button>
    );
  }
  return (
    <Button size="sm" variant="ghost" className="size-8 p-0" asChild>
      <Link href={href} scroll={false} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}

/**
 * First page, last page, and a window around the current one, with gaps
 * marked. Keeps the control a fixed width no matter how many pages exist.
 */
function pageNumbers(page: number, pageCount: number): Array<number | "gap"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, pageCount, page]);
  if (page - 1 > 1) pages.add(page - 1);
  if (page + 1 < pageCount) pages.add(page + 1);
  // Keep the control from changing width at the ends of the range.
  if (page <= 3) [2, 3, 4].forEach((entry) => pages.add(entry));
  if (page >= pageCount - 2) {
    [pageCount - 3, pageCount - 2, pageCount - 1].forEach((entry) =>
      pages.add(entry),
    );
  }

  const sorted = [...pages]
    .filter((entry) => entry >= 1 && entry <= pageCount)
    .sort((a, b) => a - b);

  const result: Array<number | "gap"> = [];
  let previous = 0;
  for (const entry of sorted) {
    if (previous > 0 && entry - previous > 1) result.push("gap");
    result.push(entry);
    previous = entry;
  }
  return result;
}

