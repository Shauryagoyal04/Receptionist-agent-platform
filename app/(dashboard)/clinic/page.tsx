import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { ClinicForm } from "@/components/clinic-data/record-forms";
import { requireAdmin } from "@/lib/auth/session";
import { getClinicRecord } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = {
  title: "Clinic",
  description: "What the agent tells patients about the clinic.",
};

export default async function ClinicPage() {
  const user = await requireAdmin();

  const [clinic, definition] = await Promise.all([
    getClinicRecord(user.clinicId),
    getDefinition(user.clinicId, "clinic"),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Clinic"
        description={
          clinic.exists
            ? "What the agent tells patients about the clinic. Check the preview to hear it the way patients will."
            : "No clinic details yet. Fill these in and save, and the agent starts using them."
        }
      />
      <div className="mt-6">
        <ClinicForm
          fields={definition?.fields ?? []}
          initial={{
            clinicName: clinic.clinicName,
            timings: clinic.timings,
            address: clinic.address,
            phone: clinic.phone,
            attributes: clinic.attributes,
          }}
        />
      </div>
    </PageShell>
  );
}
