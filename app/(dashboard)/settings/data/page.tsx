import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Database } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { CreatePageForm } from "@/components/clinic-data/settings/create-page-form";
import { EmptyState } from "@/components/clinic-data/states";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { SYSTEM_PAGES, activeFields, type EntityDefinition } from "@/lib/clinic-data/model";
import { listDefinitions } from "@/lib/data/definitions";

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
  return (
    <li>
      <Link
        href={`/settings/data/${def.entityType}`}
        className="hover:bg-muted/50 flex items-center gap-3 px-4 py-3 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{def.label}</span>
            {system && <Badge variant="secondary">Built-in</Badge>}
            {def.archived && <Badge variant="outline">Archived</Badge>}
            {!system && !def.archived && def.agentEnabled && (
              <Badge className="bg-status-booked-tint text-status-booked">Agent</Badge>
            )}
          </div>
          {description && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{description}</p>
          )}
        </div>
        <span className="text-muted-foreground tabular shrink-0 text-xs">
          {count} {system ? "extra " : ""}field{count === 1 ? "" : "s"}
        </span>
        <ChevronRight className="text-muted-foreground size-4 shrink-0" />
      </Link>
    </li>
  );
}

export default async function DataSettingsPage() {
  const user = await requireAdmin();

  const { system, custom } = await listDefinitions(user.clinicId, { includeArchived: true });
  const live = custom.filter((d) => !d.archived);
  const archived = custom.filter((d) => d.archived);

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Data settings"
        description="Choose what your clinic keeps on each page, and what the agent may read. Changes reach the agent within a minute."
      />

      <section className="mt-6">
        <h2 className="text-sm font-semibold">Built-in pages</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Their core fields are fixed because booking depends on them; you can add more.
        </p>
        <Card className="mt-3 overflow-hidden py-0">
          <ul className="divide-y">
            {system.map((def) => (
              <PageRow key={def.entityType} def={def} />
            ))}
          </ul>
        </Card>
      </section>

      <section className="mt-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Clinic pages</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Lists you define, such as lab tests, services or packages.
            </p>
          </div>
        </div>
        <div className="mt-3">
          <CreatePageForm />
        </div>
        <Card className="mt-3 overflow-hidden py-0">
          {live.length === 0 ? (
            <EmptyState icon={Database} title="No clinic pages yet">
              Create one for anything patients ask about that isn&apos;t a doctor
              or the clinic itself.
            </EmptyState>
          ) : (
            <ul className="divide-y">
              {live.map((def) => (
                <PageRow key={def.entityType} def={def} />
              ))}
            </ul>
          )}
        </Card>
        {archived.length > 0 && (
          <details className="mt-3">
            <summary className="text-muted-foreground cursor-pointer text-sm">
              Archived pages ({archived.length})
            </summary>
            <Card className="mt-2 overflow-hidden py-0 opacity-80">
              <ul className="divide-y">
                {archived.map((def) => (
                  <PageRow key={def.entityType} def={def} />
                ))}
              </ul>
            </Card>
          </details>
        )}
      </section>
    </PageShell>
  );
}
