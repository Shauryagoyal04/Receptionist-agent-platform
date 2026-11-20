import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader, PageShell } from "@/components/page-header";
import { BackLink } from "@/components/clinic-data/back-link";
import { DoctorForm } from "@/components/clinic-data/record-forms";
import { requireAdmin } from "@/lib/auth/session";
import { getDoctor } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = { title: "Doctor" };

export default async function DoctorPage({ params }: PageProps<"/doctors/[id]">) {
  const user = await requireAdmin();
  const { id } = await params;

  const [doctor, definition] = await Promise.all([
    getDoctor(user.clinicId, id),
    getDefinition(user.clinicId, "doctor"),
  ]);
  if (!doctor) notFound();

  return (
    <PageShell>
      <BackLink href="/doctors">Doctors</BackLink>
      <PageHeader
        title={doctor.name ? `Dr. ${doctor.name}` : "Doctor"}
      />
      <div className="mt-6">
        <DoctorForm
          key={doctor.updatedAt ?? doctor.id}
          fields={definition?.fields ?? []}
          initial={{
            id: doctor.id,
            name: doctor.name,
            specialization: doctor.specialization,
            calendarEmail: doctor.calendarEmail,
            isActive: doctor.isActive,
            availableDays: doctor.availableDays,
            workingHours: doctor.workingHours,
            consultationDuration: doctor.consultationDuration,
            attributes: doctor.attributes,
          }}
        />
      </div>
    </PageShell>
  );
}
