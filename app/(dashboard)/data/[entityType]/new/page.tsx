import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/page-header";
import { BackLink } from "@/components/clinic-data/back-link";
import { RecordForm } from "@/components/clinic-data/record-forms";
import { requireAdmin } from "@/lib/auth/session";
import { isSystemEntityType } from "@/lib/clinic-data/model";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = { title: "Add" };

export default async function NewRecordPage({ params }: PageProps<"/data/[entityType]/new">) {
  const user = await requireAdmin();
  const { entityType } = await params;
  if (isSystemEntityType(entityType)) notFound();
  const definition = await getDefinition(user.clinicId, entityType);
  if (!definition || definition.kind !== "custom" || definition.archived) notFound();

  return (
    <PageShell>
      <BackLink href={`/data/${entityType}`}>{definition.label}</BackLink>
      <PageHeader
        title={`Add ${definition.singularLabel.toLowerCase()}`}
        description={
          definition.agentEnabled
            ? "Once saved, the agent can use this to answer patients."
            : "Staff-only. The agent doesn't read this page."
        }
      />
      <div className="mt-6">
        <RecordForm
          entityType={entityType}
          singularLabel={definition.singularLabel}
          fields={definition.fields}
          initial={{ id: null, isActive: true, attributes: {} }}
          agentEnabled={definition.agentEnabled}
        />
      </div>
    </PageShell>
  );
}
