import { ChartNoAxesColumn, MessagesSquare } from "lucide-react";

/**
 * The console's two destinations, defined once so the desktop rail and the
 * mobile tab bar cannot drift apart.
 *
 * `segment` is what `useSelectedLayoutSegment()` returns for each route, which
 * is what drives the active state — matching on pathname prefixes instead
 * would light up "Conversations" while on a conversation detail page only by
 * accident, and would break the moment a route moves.
 */
export const NAV_ITEMS = [
  {
    href: "/analytics",
    segment: "analytics",
    label: "Analytics",
    icon: ChartNoAxesColumn,
    description: "How the agent performed over time",
  },
  {
    href: "/conversations",
    segment: "conversations",
    label: "Conversations",
    icon: MessagesSquare,
    description: "Browse and review individual calls and chats",
  },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];
