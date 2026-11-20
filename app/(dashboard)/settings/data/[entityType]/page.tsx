import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, EyeOff, Lock, TriangleAlert } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { FieldBuilder } from "@/components/clinic-data/settings/field-builder";
import { PageMetaForm } from "@/components/clinic-data/settings/page-meta-form";
import {
  AgentAccessBadge,
  agentAccess,
  PageIcon,
} from "@/components/clinic-data/settings/page-visuals";
import { AdminOnly } from "@/components/clinic-data/states";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import {
  SYSTEM_PAGES,
  activeFields,
  isAgentVisible,
  isSystemEntityType,
} from "@/lib/clinic-data/model";
import { getDefinition } from "@/lib/data/definitions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Page settings" };

export default async function PageSettings({
  params,
}: PageProps<"/settings/data/[entityType]">) {
  const user = await requireAdmin();
  if (user.role !== "admin") return <AdminOnly />;

  const { entityType } = await params;
  const def = await getDefinition(user.clinicId, entityType);
  if (!def) notFound();
  const system = isSystemEntityType(entityType);
  const viewHref = system ? SYSTEM_PAGES[entityType].href : `/data/${entityType}`;
  const access = agentAccess(def);
  const fields = activeFields(def.fields);
  const agentFields = access === "reads" ? fields.filter(isAgentVisible) : [];
  const privateFields = fields.filter((f) => f.pii);

  return (
    <PageShell>
      <Link
        href="/settings/data"
        className="group/back text-ink-3 hover:text-ink -ml-1 mb-3 inline-flex items-center gap-1.5 rounded-md px-1 text-[13px] font-medium transition-colors duration-(--dur-quick)"
      >
        <ArrowLeft
          aria-hidden="true"
          className="size-4 transition-transform duration-(--dur-quick) group-hover/back:-translate-x-0.5"
        />
        Data settings
      </Link>

      <div className="flex items-start gap-4">
        <span
          className={cn(
            "mt-0.5 hidden size-12 shrink-0 items-center justify-center rounded-xl sm:flex",
            access === "reads" ? "bg-agent-soft text-agent" : "bg-sunken text-ink-3",
          )}
        >
          <PageIcon page={def} className="size-6" />
        </span>
        <PageHeader
          className="min-w-0 flex-1"
          title={def.label}
        >
          {!def.archived && (
            <Button variant="outline" asChild>
              <Link href={viewHref}>
                Open {def.label.toLowerCase()}
                <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          )}
        </PageHeader>
      </div>

      {!def.intact && (
        <p
          role="status"
          className="bg-danger-soft text-danger-text mt-6 flex items-start gap-2.5 rounded-[10px] px-4 py-3 text-[13px]"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          This page has fields of a type the console doesn&apos;t recognise yet, so it can&apos;t
          be edited here until the console is updated. Nothing has been lost.
        </p>
      )}

      <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-6">
          {!system && (
            <PageMetaForm
              key={`meta-${def.version}`}
              entityType={entityType}
              version={def.version}
              archived={def.archived}
              fields={def.fields}
              initial={{
                label: def.label,
                singularLabel: def.singularLabel,
                description: def.description,
                agentEnabled: def.agentEnabled,
                titleField: def.titleField,
              }}
            />
          )}
          {!def.archived && (
            <FieldBuilder
              entityType={entityType}
              version={def.version}
              fields={def.fields}
              titleField={def.titleField}
              staffOnly={entityType === "patient"}
            />
          )}
        </div>

        {/* What the agent will actually see, so admins don't have to infer
            it from the switches on every field. */}
        <aside
          aria-labelledby="agent-use-title"
          className="bg-surface border-line rounded-xl border p-5 xl:sticky xl:top-8"
        >
          <h2 id="agent-use-title" className="text-ink text-[15px] font-semibold">
            How the agent uses this page
          </h2>
          <AgentAccessBadge access={access} className="mt-3" />
          <p className="text-ink-2 mt-3 text-[13px] leading-5">
            {access === "archived"
              ? "Archived pages are hidden from staff and the agent. Their rows are kept, and restoring the page brings everything back."
              : entityType === "patient"
                ? "Patient details are for staff only. The agent never reads them, whatever the field settings say."
                : access === "reads"
                  ? system
                    ? "The agent reads this page to answer patients and book appointments."
                    : `The agent searches active ${def.label.toLowerCase()} when a patient asks about them.`
                  : "The agent can't search this page. Turn on “Agent can search this page” to let it answer from these rows."}
          </p>

          {agentFields.length > 0 && (
            <div className="border-line mt-4 border-t pt-4">
              <p className="text-ink-3 text-xs font-medium">
                {system ? "Extra fields it can read" : "Fields it can read"}
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {agentFields.map((f) => (
                  <li
                    key={f.key}
                    className="bg-agent-soft text-agent-text inline-flex h-6 items-center rounded-full px-2.5 text-xs"
                  >
                    {f.label}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {privateFields.length > 0 && (
            <div className="border-line mt-4 border-t pt-4">
              <p className="text-ink-3 flex items-center gap-1.5 text-xs font-medium">
                <Lock className="size-3.5" aria-hidden="true" />
                Kept private
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {privateFields.map((f) => (
                  <li
                    key={f.key}
                    className="bg-sunken text-ink-2 inline-flex h-6 items-center rounded-full px-2.5 text-xs"
                  >
                    {f.label}
                  </li>
                ))}
              </ul>
              <p className="text-ink-3 mt-2 text-xs">Personal data is never sent to the agent.</p>
            </div>
          )}

          {access === "reads" && agentFields.length === 0 && !system && (
            <p className="text-ink-3 border-line mt-4 flex items-start gap-2 border-t pt-4 text-xs">
              <EyeOff className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              No field is visible to the agent yet, so it has nothing to answer from.
            </p>
          )}
        </aside>
      </div>
    </PageShell>
  );
}
