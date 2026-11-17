import type { Metadata } from "next";
import Link from "next/link";
import { SearchX, Users } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Pagination } from "@/components/conversations/pagination";
import { ListFilters, parseFilterParams } from "@/components/clinic-data/list-filters";
import { EmptyState } from "@/components/clinic-data/states";
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
import { PATIENT_PAGE_SIZE, listPatients } from "@/lib/data/clinic-records";

export const metadata: Metadata = {
  title: "Patients",
  description: "People who have contacted the clinic.",
};

export default async function PatientsPage({ searchParams }: PageProps<"/patients">) {
  const user = await requireAdmin();

  const raw = await searchParams;
  const { q } = parseFilterParams(raw);
  const pageParam = Number(Array.isArray(raw.page) ? raw.page[0] : raw.page);
  const result = await listPatients(user.clinicId, {
    q,
    page: Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1,
  });
  const rangeStart = (result.page - 1) * PATIENT_PAGE_SIZE + 1;

  return (
    <PageShell>
      <PageHeader
        title="Patients"
        description="The agent adds patients when they book. Extra fields here are staff-only."
      />

      <div className="mt-6">
        <ListFilters
          basePath="/patients"
          fields={[]}
          q={q}
          filters={{}}
          searchPlaceholder="Search name or phone"
        />
      </div>

      <Card className="mt-4 overflow-hidden py-0">
        {result.patients.length === 0 ? (
          q ? (
            <EmptyState icon={SearchX} title="No patients match that search" />
          ) : (
            <EmptyState icon={Users} title="No patients yet">
              Patients appear here once they book through the agent.
            </EmptyState>
          )
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Age</TableHead>
                  <TableHead className="pr-4">Gender</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.patients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="pl-4 font-medium">
                      <Link href={`/patients/${patient.id}`} className="hover:underline">
                        {patient.name || "Unnamed"}
                      </Link>
                    </TableCell>
                    <TableCell className="tabular font-mono text-xs">{patient.phone || "—"}</TableCell>
                    <TableCell className="tabular">{patient.age ?? "—"}</TableCell>
                    <TableCell className="pr-4">{patient.gender ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={result.page}
              pageCount={result.pageCount}
              total={result.total}
              rangeStart={rangeStart}
              rangeEnd={rangeStart + result.patients.length - 1}
              hrefFor={(target) => {
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (target > 1) params.set("page", String(target));
                const qs = params.toString();
                return `/patients${qs ? `?${qs}` : ""}`;
              }}
            />
          </>
        )}
      </Card>
    </PageShell>
  );
}
