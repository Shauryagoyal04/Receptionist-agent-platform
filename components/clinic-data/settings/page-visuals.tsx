import {
  AlignLeft,
  Building2,
  Calendar,
  CircleDot,
  Hash,
  Link2,
  ListChecks,
  Mail,
  Phone,
  Tags,
  ToggleLeft,
  Type,
  UsersRound,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { createElement } from "react";

import { customPageIcon } from "@/components/shell/nav-items";
import type { FieldType } from "@/lib/clinic-data/model";
import { cn } from "@/lib/utils";

/*
 * Shared visuals for the Data settings pages: the same icon a page has in
 * the sidebar, and one plain sentence for what the agent does with it.
 */

const SYSTEM_ICONS: Record<string, LucideIcon> = {
  clinic: Building2,
  doctor: Stethoscope,
  patient: UsersRound,
};

export function pageIcon(page: { entityType: string; label: string }): LucideIcon {
  return SYSTEM_ICONS[page.entityType] ?? customPageIcon(page);
}

/** The page's icon, as an element (picked from a static set by name). */
export function PageIcon({
  page,
  className,
}: {
  page: { entityType: string; label: string };
  className?: string;
}) {
  return createElement(pageIcon(page), { className, strokeWidth: 1.75, "aria-hidden": true });
}

export type AgentAccess = "reads" | "staff-only" | "archived";

/**
 * Built-in pages don't store an agent switch (it is always false on them):
 * the agent always reads Clinic and Doctors, and never Patients. Clinic
 * pages follow their own "agent can search" switch.
 */
export function agentAccess(page: {
  entityType: string;
  kind: "system" | "custom";
  agentEnabled: boolean;
  archived: boolean;
}): AgentAccess {
  if (page.archived) return "archived";
  if (page.entityType === "patient") return "staff-only";
  if (page.kind === "system") return "reads";
  return page.agentEnabled ? "reads" : "staff-only";
}

export const AGENT_ACCESS_LABEL: Record<AgentAccess, string> = {
  reads: "Agent reads this",
  "staff-only": "Staff only",
  archived: "Archived",
};

/** Dot + label pill: petrol when the agent reads the page, grey otherwise. */
export function AgentAccessBadge({ access, className }: { access: AgentAccess; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        access === "reads" ? "bg-agent-soft text-agent-text" : "bg-none-soft text-none-text",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", access === "reads" ? "bg-agent" : "bg-none")}
      />
      {AGENT_ACCESS_LABEL[access]}
    </span>
  );
}

export const FIELD_TYPE_ICON: Record<FieldType, LucideIcon> = {
  text: Type,
  longtext: AlignLeft,
  number: Hash,
  boolean: ToggleLeft,
  date: Calendar,
  select: CircleDot,
  multiselect: ListChecks,
  tags: Tags,
  email: Mail,
  phone: Phone,
  url: Link2,
};
