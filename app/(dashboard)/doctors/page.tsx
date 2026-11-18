import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Plus, SearchX, Stethoscope } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { ActiveToggle } from "@/components/clinic-data/active-toggle";
import { ListFilters, parseFilterParams } from "@/components/clinic-data/list-filters";
import { EmptyState } from "@/components/clinic-data/states";
import { WeekStrip } from "@/components/clinic-data/week-strip";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth/session";
import { formatAttribute, formatTime } from "@/lib/clinic-data/format";
import { activeFields } from "@/lib/clinic-data/model";
import { listDoctors } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";
import { cn, initialsOf } from "@/lib/utils";

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
  const activeCount = doctors.filter((d) => d.isActive).length;

  return (
    <PageShell>
      <PageHeader
        title={doctors.length > 0 && !filtered ? `Doctors · ${doctors.length}` : "Doctors"}
        description="The agent offers active doctors' open slots when a patient asks to book. Hide a doctor instead of deleting them."
      >
        <Button asChild>
          <Link href="/doctors/new">
            <Plus />
            Add doctor
          </Link>
        </Button>
      </PageHeader>

      {(doctors.length > 0 || filtered) && (
        <div className="bg-surface border-line mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
          <ListFilters
            basePath="/doctors"
            fields={fields}
            q={q}
            filters={filters}
            searchPlaceholder="Search name or specialization"
          />
          {doctors.length > 0 && (
            <p className="text-ink-3 px-1 text-[13px]">
              <span className="tnum text-ink-2 font-medium">{activeCount}</span> of{" "}
              <span className="tnum">{doctors.length}</span> offered to patients
            </p>
          )}
        </div>
      )}

      {doctors.length === 0 ? (
        <div className="bg-surface border-line mt-5 rounded-xl border">
          {filtered ? (
            <EmptyState
              icon={SearchX}
              tone="none"
              title="No doctors match these filters"
              action={
                <Button variant="outline" asChild>
                  <Link href="/doctors">Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Stethoscope}
              title="No doctors yet"
              action={
                <Button asChild>
                  <Link href="/doctors/new">
                    <Plus />
                    Add doctor
                  </Link>
                </Button>
              }
            >
              Add your doctors so the agent can offer appointments: their days, hours and slot length.
            </EmptyState>
          )}
        </div>
      ) : (
        <ul className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => {
            const name = doctor.name || "Unnamed";
            const hours =
              doctor.workingHours.start && doctor.workingHours.end
                ? `${formatTime(doctor.workingHours.start)} – ${formatTime(doctor.workingHours.end)}`
                : null;
            return (
              <li
                key={doctor.id}
                className="group/card bg-surface border-line hover:border-line-strong relative flex flex-col rounded-xl border transition-[border-color,box-shadow,transform] duration-(--dur-quick) hover:-translate-y-0.5 hover:shadow-(--shadow-hover)"
              >
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
                        doctor.isActive ? "bg-agent-soft text-agent-text" : "bg-none-soft text-none-text",
                      )}
                    >
                      {initialsOf(doctor.name || null)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/doctors/${doctor.id}`}
                        className={cn(
                          "block truncate text-[15px] font-semibold after:absolute after:inset-0 after:rounded-xl after:content-['']",
                          doctor.isActive ? "text-ink" : "text-ink-3",
                        )}
                      >
                        Dr. {name}
                      </Link>
                      {doctor.specialization ? (
                        <span className="bg-sunken text-ink-2 mt-1 inline-flex h-6 max-w-full items-center truncate rounded-full px-2.5 text-xs font-medium">
                          {doctor.specialization}
                        </span>
                      ) : (
                        <span className="text-ink-4 mt-1 block text-[13px]">No specialization</span>
                      )}
                    </div>
                    <ArrowRight
                      aria-hidden="true"
                      className="text-ink-3 size-4 shrink-0 -translate-x-1 opacity-0 transition duration-(--dur-quick) group-hover/card:translate-x-0 group-hover/card:opacity-100"
                    />
                  </div>

                  <div className="mt-5 flex flex-wrap items-end justify-between gap-3">
                    <WeekStrip days={doctor.availableDays} />
                    <span className="text-ink-3 flex items-center gap-1.5 text-[13px]">
                      <Clock className="size-3.5" aria-hidden="true" />
                      <span className="tnum">
                        {hours ?? "No hours set"}
                        {doctor.consultationDuration ? ` · ${doctor.consultationDuration} min` : ""}
                      </span>
                    </span>
                  </div>

                  {filterColumns.length > 0 && (
                    <dl className="mt-4 grid gap-1 text-[13px]">
                      {filterColumns.map((f) => (
                        <div key={f.key} className="flex gap-2">
                          <dt className="text-ink-3 shrink-0">{f.label}</dt>
                          <dd className="text-ink-2 truncate">{formatAttribute(f, doctor.attributes[f.key])}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>

                {/* Above the card's link overlay, so the switch stays clickable. */}
                <div className="border-line relative z-10 flex items-center border-t px-5 py-3">
                  <ActiveToggle
                    target={{ kind: "doctor", id: doctor.id }}
                    isActive={doctor.isActive}
                    label={name}
                    onText="Offered to patients"
                    offText="Hidden from patients"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
