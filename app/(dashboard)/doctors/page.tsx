import type { Metadata } from "next";
import Link from "next/link";
import { Plus, SearchX, Stethoscope } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { ActiveToggle } from "@/components/clinic-data/active-toggle";
import { ListFilters, parseFilterParams } from "@/components/clinic-data/list-filters";
import { EmptyState } from "@/components/clinic-data/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { formatAttribute, formatDays, formatTime } from "@/lib/clinic-data/format";
import { activeFields } from "@/lib/clinic-data/model";
import { listDoctors } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Doctors",
  description: "Who patients can book, and when.",
};

export default async function DoctorsPage({ searchParams }: PageProps<"/doctors">) {
  const user = await requireAdmin();

  const { q, filters } = parseFilterParams(await searchParams);
  const definition = await getDefinition(user.clinicId, "doctor");
  const fields = definition?.fields ?? [];
  const doctors = await listDoctors(user.clinicId, { q, fields, filters });
  const filterColumns = activeFields(fields).filter((f) => f.filterable).slice(0, 3);
  const filtered = Boolean(q) || Object.keys(filters).length > 0;

  return (
    <PageShell>
      <PageHeader
        title="Doctors"
        description="Only active doctors are offered to patients. Deactivate instead of deleting."
      >
        <Button asChild>
          <Link href="/doctors/new">
            <Plus />
            Add doctor
          </Link>
        </Button>
      </PageHeader>

      <div className="mt-6">
        <ListFilters
          basePath="/doctors"
          fields={fields}
          q={q}
          filters={filters}
          searchPlaceholder="Search name or specialization"
        />
      </div>

      <Card className="mt-4 overflow-hidden py-0">
        {doctors.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="No doctors match these filters" />
          ) : (
            <EmptyState
              icon={Stethoscope}
              title="No doctors yet"
              action={
                <Button size="sm" asChild>
                  <Link href="/doctors/new">Add the first doctor</Link>
                </Button>
              }
            >
              Add the doctors patients can book with, their days and hours.
            </EmptyState>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Name</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Days</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Slot</TableHead>
                {filterColumns.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
                <TableHead className="pr-4 text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors.map((doctor) => (
                <TableRow key={doctor.id} className={cn(!doctor.isActive && "text-muted-foreground")}>
                  <TableCell className="pl-4 font-medium">
                    <Link href={`/doctors/${doctor.id}`} className="hover:underline">
                      {doctor.name || "Unnamed"}
                    </Link>
                  </TableCell>
                  <TableCell>{doctor.specialization || "—"}</TableCell>
                  <TableCell>{formatDays(doctor.availableDays)}</TableCell>
                  <TableCell className="tabular font-mono text-xs">
                    {doctor.workingHours.start && doctor.workingHours.end
                      ? `${formatTime(doctor.workingHours.start)} – ${formatTime(doctor.workingHours.end)}`
                      : "—"}
                  </TableCell>
                  <TableCell className="tabular font-mono text-xs">
                    {doctor.consultationDuration ? `${doctor.consultationDuration} min` : "—"}
                  </TableCell>
                  {filterColumns.map((f) => (
                    <TableCell key={f.key}>{formatAttribute(f, doctor.attributes[f.key])}</TableCell>
                  ))}
                  <TableCell className="pr-4 text-right">
                    <ActiveToggle
                      target={{ kind: "doctor", id: doctor.id }}
                      isActive={doctor.isActive}
                      label={doctor.name}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
