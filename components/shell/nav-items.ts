import {
  Building2,
  ChartNoAxesColumn,
  FileText,
  FlaskConical,
  HandCoins,
  Headset,
  IdCard,
  MessagesSquare,
  ReceiptIndianRupee,
  Settings2,
  Stethoscope,
  UserCog,
  UsersRound,
  type LucideIcon,
} from "lucide-react";

/**
 * The console's destinations, defined once so the desktop rail and the
 * mobile tab bar cannot drift apart.
 *
 * Grouped by the job staff come to do: watch the agent and step in (the
 * desk), keep what it tells patients correct, and run the console. Every
 * item has its own icon, so nothing is told apart by its label alone.
 *
 * `segments` is the route below the dashboard layout, as
 * `useSelectedLayoutSegments()` returns it; an item is active when the
 * current route starts with it. Matching on segments rather than pathname
 * prefixes keeps "/data/lab_test" from lighting up "/data/lab_tests".
 */
export type NavBadge = "openEscalations" | "pendingUsers";

export type NavItem = {
  href: string;
  segments: readonly string[];
  label: string;
  icon: LucideIcon;
  description: string;
  /** Hidden from staff, who only get Analytics, Conversations and Escalations. */
  adminOnly?: boolean;
  /** A live count next to the label (open escalations, accounts to approve). */
  badge?: NavBadge;
};

export type NavGroupId = "desk" | "knowledge" | "admin";

export const DESK_ITEMS: readonly NavItem[] = [
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
    icon: Headset,
    description: "Patients who asked for a person",
    badge: "openEscalations",
  },
  {
    href: "/patients",
    segments: ["patients"],
    label: "Patients",
    icon: UsersRound,
    description: "People who have contacted the clinic",
    adminOnly: true,
  },
];

/** What the agent reads to patients. Custom pages are appended to these. */
export const KNOWLEDGE_ITEMS: readonly NavItem[] = [
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
];

export const ADMIN_ITEMS: readonly NavItem[] = [
  {
    href: "/team",
    segments: ["team"],
    label: "Team",
    icon: UserCog,
    description: "Who can sign in, and what they can see",
    badge: "pendingUsers",
    adminOnly: true,
  },
  {
    href: "/settings/data",
    segments: ["settings", "data"],
    label: "Data settings",
    icon: Settings2,
    description: "Pages and fields the clinic keeps",
    adminOnly: true,
  },
];

export const NAV_GROUP_LABELS: Record<NavGroupId, string | null> = {
  desk: null,
  knowledge: "What the agent knows",
  admin: "Admin",
};

/** Serializable form of a custom page, passed from the layout (admins only). */
export type CustomNavPage = { entityType: string; label: string };

/*
 * Custom pages are named by the clinic, so their icon is picked from what the
 * name says. Reusing one generic icon for Services, Staff and Schemes would
 * make three different pages look like the same thing.
 */
const CUSTOM_ICON_RULES: Array<{ pattern: RegExp; icon: LucideIcon }> = [
  { pattern: /scheme|subsid|insur|ayushman|cghs|pmjay|concession/i, icon: HandCoins },
  { pattern: /service|charge|fee|price|tariff|rate|package/i, icon: ReceiptIndianRupee },
  { pattern: /staff|nurse|employee|reception|team member/i, icon: IdCard },
  { pattern: /lab|test|diagnos|report|scan|patholog/i, icon: FlaskConical },
];

export function customPageIcon(page: CustomNavPage): LucideIcon {
  const text = `${page.entityType} ${page.label}`;
  return CUSTOM_ICON_RULES.find((rule) => rule.pattern.test(text))?.icon ?? FileText;
}
