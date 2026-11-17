import {
  Building2,
  ChartNoAxesColumn,
  Database,
  Headphones,
  MessagesSquare,
  Settings2,
  Stethoscope,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * The console's destinations, defined once so the desktop rail and the
 * mobile tab bar cannot drift apart.
 *
 * `segments` is the route below the dashboard layout, as
 * `useSelectedLayoutSegments()` returns it; an item is active when the
 * current route starts with it. Matching on segments rather than pathname
 * prefixes keeps "/data/lab_test" from lighting up "/data/lab_tests".
 */
export type NavItem = {
  href: string;
  segments: readonly string[];
  label: string;
  icon: LucideIcon;
  description: string;
  /** Hidden from staff, who only get Analytics, Conversations and Escalations. */
  adminOnly?: boolean;
  /** Shows the count of open escalations next to the label. */
  showsOpenEscalations?: boolean;
};

export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: "/analytics",
    segments: ["analytics"],
    label: "Analytics",
    icon: ChartNoAxesColumn,
    description: "How the agent performed over time",
  },
  {
    href: "/conversations",
    segments: ["conversations"],
    label: "Conversations",
    icon: MessagesSquare,
    description: "Browse and review individual calls and chats",
  },
  {
    href: "/escalations",
    segments: ["escalations"],
    label: "Escalations",
    icon: Headphones,
    description: "Patients who asked for a person",
    showsOpenEscalations: true,
  },
  {
    href: "/clinic",
    segments: ["clinic"],
    label: "Clinic",
    icon: Building2,
    description: "What the agent tells patients about the clinic",
    adminOnly: true,
  },
  {
    href: "/doctors",
    segments: ["doctors"],
    label: "Doctors",
    icon: Stethoscope,
    description: "Who patients can book, and when",
    adminOnly: true,
  },
  {
    href: "/patients",
    segments: ["patients"],
    label: "Patients",
    icon: Users,
    description: "People who have contacted the clinic",
    adminOnly: true,
  },
];

/** Admin-only: page and field definitions. */
export const SETTINGS_NAV_ITEM: NavItem = {
  href: "/settings/data",
  segments: ["settings", "data"],
  label: "Data settings",
  icon: Settings2,
  description: "Pages and fields the clinic keeps",
};

/** Icon for clinic-defined pages, which are listed after the fixed items. */
export const CUSTOM_PAGE_ICON = Database;

/** Serializable form of a custom page, passed from the layout (admins only). */
export type CustomNavPage = { entityType: string; label: string };
