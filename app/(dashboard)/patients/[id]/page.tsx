import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/page-header";
import { BackLink } from "@/components/clinic-data/back-link";
import { PatientForm } from "@/components/clinic-data/record-forms";
import { requireAdmin } from "@/lib/auth/session";
import { getPatient } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = { title: "Patient" };

export default async function PatientPage({ params }: PageProps<"/patients/[id]">) {
  const user = await requireAdmin();
  const { id } = await params;

  const [patient, definition] = await Promise.all([
    getPatient(user.clinicId, id),
    getDefinition(user.clinicId, "patient"),
  ]);
  if (!patient) notFound();

  return (
    <PageShell>
      <BackLink href="/patients">Patients</BackLink>
      <PageHeader
        title={patient.name || "Patient"}
        description="Kept up to date by the agent when this patient books."
      />
      <div className="mt-6">
        <PatientForm
          key={patient.updatedAt ?? patient.id}
          fields={definition?.fields ?? []}
          initial={{
            id: patient.id,
            phone: patient.phone,
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
            attributes: patient.attributes,
          }}
        />
      </div>
    </PageShell>
  );
}
