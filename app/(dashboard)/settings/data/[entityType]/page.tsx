import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { FieldBuilder } from "@/components/clinic-data/settings/field-builder";
import { PageMetaForm } from "@/components/clinic-data/settings/page-meta-form";
import { AdminOnly } from "@/components/clinic-data/states";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { SYSTEM_PAGES, isSystemEntityType } from "@/lib/clinic-data/model";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = { title: "Page settings" };

/** What each built-in page's core fields are, so admins don't duplicate them. */
const CORE_FIELDS: Record<string, string> = {
  clinic: "Clinic name, timings, address, reception phone.",
  doctor:
    "Name, specialization, active, available days, working hours, minutes per slot.",
  patient: "Phone, name, age, gender.",
};

export default async function PageSettings({
  params,
}: PageProps<"/settings/data/[entityType]">) {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.role !== "admin") return <AdminOnly />;

  const { entityType } = await params;
  const def = await getDefinition(user.clinicId, entityType);
  if (!def) notFound();
  const system = isSystemEntityType(entityType);
  const viewHref = system ? SYSTEM_PAGES[entityType].href : `/data/${entityType}`;

  return (
    <PageShell className="max-w-4xl">
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/settings/data">
          <ArrowLeft />
          Data settings
        </Link>
      </Button>
      <PageHeader
        title={def.label}
        description={
          system
            ? `Built-in page. Core fields: ${CORE_FIELDS[entityType]} Fields you add here are stored alongside them.`
            : def.description || undefined
        }
      >
        {!def.archived && (
          <Button variant="outline" asChild>
            <Link href={viewHref}>Open page</Link>
          </Button>
        )}
      </PageHeader>

      {!def.intact && (
        <Card className="mt-6">
          <CardContent className="flex items-start gap-3 text-sm">
            <TriangleAlert className="text-status-escalated mt-0.5 size-4 shrink-0" />
            This page has fields of a type this console doesn&apos;t recognise, so
            it can&apos;t be edited here until the console is updated.
          </CardContent>
        </Card>
      )}

      <div className="mt-6 flex flex-col gap-6">
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
    </PageShell>
  );
}
