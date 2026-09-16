"use client";

import Link from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";

import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/shell/nav-items";

/**
 * Navigation for the fixed left rail. A Client Component only because the
 * active state depends on the current segment; everything around it stays on
 * the server.
 */
export function SidebarNav() {
  const segment = useSelectedLayoutSegment();

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map((item) => {
        const active = segment === item.segment;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * The same destinations as a horizontal tab bar for narrow screens. With only
 * two items this is better than a drawer: no toggle to discover, no focus
 * trap to get wrong, and both destinations stay one tap away.
 */
export function MobileNav() {
  const segment = useSelectedLayoutSegment();

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
      {NAV_ITEMS.map((item) => {
        const active = segment === item.segment;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
