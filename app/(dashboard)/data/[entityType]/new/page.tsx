import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/page-header";
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
    <PageShell className="max-w-4xl">
      <PageHeader
        title={`Add ${definition.singularLabel.toLowerCase()}`}
        description={definition.label}
      />
      <div className="mt-6">
        <RecordForm
          entityType={entityType}
          singularLabel={definition.singularLabel}
          fields={definition.fields}
          initial={{ id: null, isActive: true, attributes: {} }}
        />
      </div>
    </PageShell>
  );
}
