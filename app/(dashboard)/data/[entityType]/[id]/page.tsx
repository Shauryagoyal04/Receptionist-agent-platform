import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/page-header";
import { BackLink } from "@/components/clinic-data/back-link";
import { RecordForm } from "@/components/clinic-data/record-forms";
import { requireAdmin } from "@/lib/auth/session";
import { isSystemEntityType } from "@/lib/clinic-data/model";
import { getRecord } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = { title: "Edit" };

export default async function RecordPage({ params }: PageProps<"/data/[entityType]/[id]">) {
  const user = await requireAdmin();
  const { entityType, id } = await params;
  if (isSystemEntityType(entityType)) notFound();

  const [definition, record] = await Promise.all([
    getDefinition(user.clinicId, entityType),
    getRecord(user.clinicId, entityType, id),
  ]);
  if (!definition || definition.kind !== "custom" || definition.archived || !record) {
    notFound();
  }

  const title = definition.titleField ? record.attributes[definition.titleField] : null;

  return (
    <PageShell>
      <BackLink href={`/data/${entityType}`}>{definition.label}</BackLink>
      <PageHeader
        title={typeof title === "string" && title ? title : definition.singularLabel}
      />
      <div className="mt-6">
        <RecordForm
          key={record.updatedAt ?? record.id}
          entityType={entityType}
          singularLabel={definition.singularLabel}
          fields={definition.fields}
          initial={{ id: record.id, isActive: record.isActive, attributes: record.attributes }}
          agentEnabled={definition.agentEnabled}
        />
      </div>
    </PageShell>
  );
}
