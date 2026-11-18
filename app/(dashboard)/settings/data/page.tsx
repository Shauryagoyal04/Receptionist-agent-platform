import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronRight, LayoutList } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { RegionEmpty } from "@/components/analytics/panel";
import { CreatePageForm } from "@/components/clinic-data/settings/create-page-form";
import {
  AgentAccessBadge,
  agentAccess,
  PageIcon,
} from "@/components/clinic-data/settings/page-visuals";
import { requireAdmin } from "@/lib/auth/session";
import { SYSTEM_PAGES, activeFields, type EntityDefinition } from "@/lib/clinic-data/model";
import { listDefinitions } from "@/lib/data/definitions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Data settings",
  description: "Pages and fields the clinic keeps, and what the agent may read.",
};

function PageRow({ def }: { def: EntityDefinition }) {
  const count = activeFields(def.fields).length;
  const system = def.kind === "system";
  const description = system
    ? SYSTEM_PAGES[def.entityType as keyof typeof SYSTEM_PAGES].description
    : def.description;
  const access = agentAccess(def);

  return (
    <li className="border-line border-t first:border-t-0">
      <Link
        href={`/settings/data/${def.entityType}`}
        className="group/row hover:bg-sunken/60 flex min-h-[72px] items-center gap-4 px-5 py-3 transition-colors duration-(--dur-quick)"
      >
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[10px]",
            access === "reads" ? "bg-agent-soft text-agent" : "bg-sunken text-ink-3",
          )}
        >
          <PageIcon page={def} className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-ink text-[15px] font-medium">{def.label}</span>
            {system && (
              <span className="bg-sunken text-ink-3 inline-flex h-5 items-center rounded-full px-2 text-xs">
                Built-in
              </span>
            )}
          </span>
          {description && (
            <span className="text-ink-3 mt-0.5 block truncate text-[13px] leading-[18px]">
              {description}
            </span>
          )}
        </span>
        <AgentAccessBadge access={access} className="hidden sm:inline-flex" />
        <span className="tnum text-ink-2 hidden w-24 shrink-0 text-right text-[13px] md:block">
          {count === 0 && system
            ? "No extra fields"
            : `${count} ${system ? "extra " : ""}${count === 1 ? "field" : "fields"}`}
        </span>
        <ChevronRight
          aria-hidden="true"
          className="text-ink-4 group-hover/row:text-ink-2 size-4 shrink-0 transition-[color,transform] duration-(--dur-quick) group-hover/row:translate-x-0.5"
        />
      </Link>
    </li>
  );
}

function PageList({ defs, muted }: { defs: EntityDefinition[]; muted?: boolean }) {
  return (
    <ul
      className={cn(
        "bg-surface border-line overflow-hidden rounded-xl border",
        muted && "opacity-80",
      )}
    >
      {defs.map((def) => (
        <PageRow key={def.entityType} def={def} />
      ))}
    </ul>
  );
}

function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-ink text-[17px] leading-6 font-semibold">
          {title}
        </h2>
        <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">{description}</p>
      </div>
      {action}
    </div>
  );
}

export default async function DataSettingsPage() {
  const user = await requireAdmin();

  const { system, custom } = await listDefinitions(user.clinicId, { includeArchived: true });
  const live = custom.filter((d) => !d.archived);
  const archived = custom.filter((d) => d.archived);
  const agentReads = [...system, ...live].filter((d) => agentAccess(d) === "reads").length;

  return (
    <PageShell className="max-w-5xl">
      <PageHeader
        title="Data settings"
        description="Choose what the clinic keeps on each page, and what the agent may read to patients."
      />

      <p className="text-ink-3 mt-3 text-[13px]">
        <span className="tnum text-ink-2 font-medium">
          {system.length + live.length} pages
        </span>{" "}
        · the agent reads {agentReads}. Changes reach the agent within a minute.
      </p>

      <section aria-labelledby="builtin-title" className="mt-8">
        <SectionHeading
          id="builtin-title"
          title="Built-in pages"
          description="Booking depends on their core fields, so those stay fixed. You can add more fields."
        />
        <PageList defs={system} />
      </section>

      <section aria-labelledby="custom-title" className="mt-10">
        <SectionHeading
          id="custom-title"
          title="Clinic pages"
          description="Lists you define, such as services and charges, staff, or subsidies and schemes."
        />
        <div className="mb-3">
          <CreatePageForm />
        </div>
        {live.length === 0 ? (
          <div className="bg-surface border-line rounded-xl border p-5">
            <RegionEmpty icon={LayoutList} title="No clinic pages yet.">
              Add one for anything patients ask about that isn&apos;t a doctor or the clinic
              itself: test prices, packages, insurance schemes. The agent can then answer from it.
            </RegionEmpty>
          </div>
        ) : (
          <PageList defs={live} />
        )}

        {archived.length > 0 && (
          <details className="group/archived mt-4">
            <summary className="text-ink-3 hover:text-ink-2 flex w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[13px] font-medium transition-colors duration-(--dur-quick) [&::-webkit-details-marker]:hidden">
              <Archive className="size-4" aria-hidden="true" />
              Archived pages ({archived.length})
              <ChevronRight
                aria-hidden="true"
                className="size-3.5 transition-transform duration-(--dur-base) group-open/archived:rotate-90"
              />
            </summary>
            <div className="mt-3">
              <PageList defs={archived} muted />
            </div>
          </details>
        )}
      </section>
    </PageShell>
  );
}
