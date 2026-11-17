"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  CUSTOM_PAGE_ICON,
  NAV_ITEMS,
  SETTINGS_NAV_ITEM,
  type CustomNavPage,
  type NavItem,
} from "@/components/shell/nav-items";

/*
 * Navigation for the fixed left rail and the mobile tab bar. A Client
 * Component only because the active state depends on the current segments;
 * the list of custom pages and the role come from the layout as props.
 */

type NavProps = {
  customPages: CustomNavPage[];
  isAdmin: boolean;
  /** Open escalations, shown as a count next to "Escalations". */
  openEscalations: number;
};

function useNav({ customPages, isAdmin }: NavProps) {
  const current = useSelectedLayoutSegments().filter(
    (segment) => !segment.startsWith("("),
  );
  // Staff only get the fixed staff pages; custom pages are clinic data.
  const custom: NavItem[] = (isAdmin ? customPages : []).map((page) => ({
    href: `/data/${page.entityType}`,
    segments: ["data", page.entityType],
    label: page.label,
    icon: CUSTOM_PAGE_ICON,
    description: page.label,
  }));
  const isActive = (item: NavItem) =>
    item.segments.every((segment, index) => current[index] === segment);
  return {
    main: NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly),
    custom,
    settings: isAdmin ? [SETTINGS_NAV_ITEM] : [],
    isActive,
  };
}

function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="bg-status-escalated text-background tabular ml-auto rounded-full px-1.5 text-[11px] leading-5 font-medium"
      aria-label={`${count} open`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RailLink({
  item,
  active,
  count,
}: {
  item: NavItem;
  active: boolean;
  count: number;
}) {
  const Icon = item.icon;
  return (
    <Link
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
      <span className="truncate">{item.label}</span>
      {item.showsOpenEscalations && <CountBadge count={count} />}
    </Link>
  );
}

export function SidebarNav(props: NavProps) {
  const { main, custom, settings, isActive } = useNav(props);

  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5 px-3">
      {main.map((item) => (
        <RailLink
          key={item.href}
          item={item}
          active={isActive(item)}
          count={props.openEscalations}
        />
      ))}
      {custom.length > 0 && (
        <>
          <p className="text-sidebar-foreground/50 mt-4 mb-1 px-2.5 text-xs font-medium">
            Clinic pages
          </p>
          {custom.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(item)} count={0} />
          ))}
        </>
      )}
      {settings.length > 0 && (
        <div className="mt-4">
          {settings.map((item) => (
            <RailLink key={item.href} item={item} active={isActive(item)} count={0} />
          ))}
        </div>
      )}
    </nav>
  );
}

/**
 * The same destinations as a horizontally scrolling tab bar for narrow
 * screens: no drawer to discover, no focus trap to get wrong.
 */
export function MobileNav(props: NavProps) {
  const { main, custom, settings, isActive } = useNav(props);

  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2">
      {[...main, ...custom, ...settings].map((item) => {
        const active = isActive(item);
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
            {item.showsOpenEscalations && (
              <CountBadge count={props.openEscalations} />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
