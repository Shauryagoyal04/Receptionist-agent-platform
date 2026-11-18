"use client";

import * as React from "react";
import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";

import { cn } from "@/lib/utils";
import {
  ADMIN_ITEMS,
  DESK_ITEMS,
  KNOWLEDGE_ITEMS,
  NAV_GROUP_LABELS,
  customPageIcon,
  type CustomNavPage,
  type NavBadge,
  type NavGroupId,
  type NavItem,
} from "@/components/shell/nav-items";

/*
 * Navigation for the fixed left rail and the mobile tab bar. A Client
 * Component only because the active state depends on the current segments
 * (and the badge bounces when its count rises); the list of custom pages and
 * the role come from the layout as props.
 */

type NavProps = {
  customPages: CustomNavPage[];
  isAdmin: boolean;
  /** Open escalations, shown as a count next to "Escalations". */
  openEscalations: number;
  /** Accounts waiting for approval, shown next to "Team" (admins only). */
  pendingUsers: number;
};

type NavGroup = { id: NavGroupId; label: string | null; items: NavItem[] };

function badgeCount(item: NavItem, props: NavProps): number {
  const counts: Record<NavBadge, number> = {
    openEscalations: props.openEscalations,
    pendingUsers: props.pendingUsers,
  };
  return item.badge ? counts[item.badge] : 0;
}

function useNav({ customPages, isAdmin }: NavProps) {
  const current = useSelectedLayoutSegments().filter((segment) => !segment.startsWith("("));
  const visible = (items: readonly NavItem[]) => items.filter((item) => isAdmin || !item.adminOnly);

  // Staff only get the fixed desk pages; custom pages are clinic data.
  const custom: NavItem[] = (isAdmin ? customPages : []).map((page) => ({
    href: `/data/${page.entityType}`,
    segments: ["data", page.entityType],
    label: page.label,
    icon: customPageIcon(page),
    description: page.label,
  }));

  const groups: NavGroup[] = (
    [
      { id: "desk", items: visible(DESK_ITEMS) },
      { id: "knowledge", items: [...visible(KNOWLEDGE_ITEMS), ...custom] },
      { id: "admin", items: visible(ADMIN_ITEMS) },
    ] as const
  )
    .map((group) => ({ ...group, items: [...group.items], label: NAV_GROUP_LABELS[group.id] }))
    .filter((group) => group.items.length > 0);

  const isActive = (item: NavItem) =>
    item.segments.every((segment, index) => current[index] === segment);

  return { groups, isActive };
}

/**
 * A count beside a nav label. Escalations are amber (the human side); other
 * counts, like accounts to approve, stay neutral. Bounces once when it rises.
 */
function CountBadge({ count, badge }: { count: number; badge?: NavBadge }) {
  const previous = React.useRef(count);
  const [bump, setBump] = React.useState(0);
  React.useEffect(() => {
    if (count > previous.current) setBump((n) => n + 1);
    previous.current = count;
  }, [count]);

  if (count <= 0) return null;
  const human = badge === "openEscalations";
  return (
    <span
      key={bump}
      className={cn(
        "tnum ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
        human ? "bg-human text-white" : "bg-sunken text-ink-2",
        bump > 0 && "md-bounce",
      )}
      aria-label={human ? `${count} waiting` : `${count} to review`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

function RailLink({ item, active, count }: { item: NavItem; active: boolean; count: number }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={item.description}
      className={cn(
        "group/nav flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-sm transition-colors duration-(--dur-quick)",
        active ? "bg-agent-soft text-agent-text font-medium" : "text-ink-2 hover:bg-sunken hover:text-ink",
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors duration-(--dur-quick)",
          active ? "text-agent" : "text-ink-3 group-hover/nav:text-ink",
        )}
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className="truncate">{item.label}</span>
      <CountBadge count={count} badge={item.badge} />
    </Link>
  );
}

export function SidebarNav(props: NavProps) {
  const { groups, isActive } = useNav(props);

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3">
      {groups.map((group) => (
        <div key={group.id} role="group" aria-label={group.label ?? "Desk"}>
          {group.label && (
            <p className="text-ink-3 mb-1 px-2.5 text-xs font-medium">{group.label}</p>
          )}
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <RailLink item={item} active={isActive(item)} count={badgeCount(item, props)} />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

/**
 * The same destinations as a horizontally scrolling tab bar for narrow
 * screens: no drawer to discover, no focus trap to get wrong. Groups are
 * separated by a hairline rather than labelled, to keep the bar one row.
 */
export function MobileNav(props: NavProps) {
  const { groups, isActive } = useNav(props);

  return (
    <nav aria-label="Main" className="flex items-center gap-1 overflow-x-auto px-3 pb-2">
      {groups.map((group, index) => (
        <React.Fragment key={group.id}>
          {index > 0 && <span aria-hidden="true" className="bg-line mx-1 h-5 w-px shrink-0" />}
          {group.items.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-10 items-center gap-2 rounded-[10px] px-3 text-sm whitespace-nowrap transition-colors duration-(--dur-quick)",
                  active ? "bg-agent-soft text-agent-text font-medium" : "text-ink-2 hover:bg-sunken",
                )}
              >
                <Icon className={cn("size-[18px] shrink-0", active ? "text-agent" : "text-ink-3")} strokeWidth={1.75} aria-hidden="true" />
                {item.label}
                <CountBadge count={badgeCount(item, props)} badge={item.badge} />
              </Link>
            );
          })}
        </React.Fragment>
      ))}
    </nav>
  );
}
