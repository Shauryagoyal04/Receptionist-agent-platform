import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, SearchX, UsersRound } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { Pagination } from "@/components/conversations/pagination";
import { ListFilters, parseFilterParams } from "@/components/clinic-data/list-filters";
import { EmptyState } from "@/components/clinic-data/states";
import { Button } from "@/components/ui/button";
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
import { initialsOf } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Patients",
  description: "People who have contacted the clinic.",
};

/** Stored as digits with country code ("919876543210"); shown as "+91 98765 43210". */
function displayPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return phone;
}

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
  const empty = result.patients.length === 0;

  return (
    <PageShell>
      <PageHeader
        title={result.total > 0 && !q ? `Patients · ${result.total.toLocaleString("en-IN")}` : "Patients"}
        description="The agent adds patients when they book, and recognises them by phone next time. Extra fields here are staff-only."
      />

      <div className="bg-surface border-line mt-6 overflow-hidden rounded-xl border">
        {(!empty || q) && (
          <ListFilters
            basePath="/patients"
            fields={[]}
            q={q}
            filters={{}}
            searchPlaceholder="Search name or phone"
            className="border-line border-b p-3"
          />
        )}

        {empty ? (
          q ? (
            <EmptyState
              icon={SearchX}
              tone="none"
              title={`No patients match “${q}”`}
              action={
                <Button variant="outline" asChild>
                  <Link href="/patients">Clear search</Link>
                </Button>
              }
            >
              Try part of the name, or the last few digits of the phone number.
            </EmptyState>
          ) : (
            <EmptyState icon={UsersRound} title="No patients yet">
              Patients appear here as soon as someone books through the agent on WhatsApp or a call.
            </EmptyState>
          )
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead className="text-right">Age</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.patients.map((patient) => (
                  <TableRow key={patient.id} className="group/row relative">
                    <TableCell>
                      <Link
                        href={`/patients/${patient.id}`}
                        className="text-ink flex items-center gap-3 font-medium after:absolute after:inset-0 after:content-['']"
                      >
                        <span
                          aria-hidden="true"
                          className="bg-sunken text-ink-2 flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                        >
                          {initialsOf(patient.name || null)}
                        </span>
                        {patient.name || <span className="text-ink-3 font-normal">Name not given</span>}
                      </Link>
                    </TableCell>
                    <TableCell className="tnum">{patient.phone ? displayPhone(patient.phone) : "—"}</TableCell>
                    <TableCell className="tnum text-right">{patient.age ?? "—"}</TableCell>
                    <TableCell>{patient.gender ?? "—"}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <ChevronRight
                        aria-hidden="true"
                        className="text-ink-4 group-hover/row:text-ink-2 ml-auto size-4 transition-[color,transform] duration-(--dur-quick) group-hover/row:translate-x-0.5"
                      />
                    </TableCell>
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
      </div>
    </PageShell>
  );
}
