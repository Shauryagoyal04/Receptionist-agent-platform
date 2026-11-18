import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * The standard card on the analytics page: 12px radius, a 1px line border,
 * no shadow at rest. The lead card is the only other style on the page.
 */

export type SrRow = { label: string; value: string };

export function Panel({
  title,
  description,
  action,
  srTable,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /**
   * The figures the visual shows, as a screen-reader table. An SVG chart is
   * unreadable to assistive tech; a table carries every value.
   */
  srTable?: { caption: string; rows: SrRow[] };
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const headingId = `panel-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <section
      aria-labelledby={headingId}
      className={cn(
        "bg-surface border-line flex min-w-0 flex-col rounded-xl border",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div className="min-w-0">
          <h2 id={headingId} className="text-ink text-[17px] leading-6 font-semibold">
            {title}
          </h2>
          {description && (
            <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">{description}</p>
          )}
        </div>
        {action}
      </header>
      <div className={cn("flex-1 px-5 pt-4 pb-5", bodyClassName)}>{children}</div>
      {srTable && srTable.rows.length > 0 && (
        <table className="sr-only">
          <caption>{srTable.caption}</caption>
          <tbody>
            {srTable.rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** "View all" style link in a panel header; the arrow hints at the move. */
export function PanelLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group/link text-agent-text hover:text-agent flex shrink-0 items-center gap-1 rounded-md text-[13px] font-medium transition-colors duration-(--dur-quick)"
    >
      {children}
      <ArrowRight className="size-3.5 transition-transform duration-(--dur-quick) group-hover/link:translate-x-0.5" />
    </Link>
  );
}

/**
 * An empty region: a small icon in a meaning-coloured well, what will appear
 * here, and how to make it appear.
 */
export function RegionEmpty({
  icon: Icon,
  tone = "agent",
  title,
  children,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone?: "agent" | "booked" | "human" | "none";
  title: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const well = {
    agent: "bg-agent-soft text-agent",
    booked: "bg-booked-soft text-booked",
    human: "bg-human-soft text-human",
    none: "bg-none-soft text-none-text",
  }[tone];
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[10px]", well)}>
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 text-[13px] leading-[18px]">
        <p className="text-ink-2 font-medium">{title}</p>
        {children && <div className="text-ink-3 mt-0.5">{children}</div>}
      </div>
    </div>
  );
}
