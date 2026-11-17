import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { DoctorForm } from "@/components/clinic-data/record-forms";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefinition } from "@/lib/data/definitions";

export const metadata: Metadata = { title: "Add doctor" };

export default async function NewDoctorPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const definition = await getDefinition(user.clinicId, "doctor");

  return (
    <PageShell className="max-w-4xl">
      <PageHeader title="Add doctor" />
      <div className="mt-6">
        <DoctorForm
          fields={definition?.fields ?? []}
          initial={{
            id: null,
            name: "",
            specialization: "",
            isActive: true,
            availableDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            workingHours: { start: "09:00", end: "17:00" },
            consultationDuration: 30,
            attributes: {},
          }}
        />
      </div>
    </PageShell>
  );
}
