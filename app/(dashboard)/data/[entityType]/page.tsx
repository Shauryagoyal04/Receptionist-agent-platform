import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EyeOff, FileText, Plus, SearchX, Sparkles } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { ActiveToggle } from "@/components/clinic-data/active-toggle";
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
import { formatAttribute } from "@/lib/clinic-data/format";
import { activeFields, isSystemEntityType, type FieldDef } from "@/lib/clinic-data/model";
import { listRecords } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clinic page" };

/** Columns after the title: up to three short, active fields. */
const SUMMARY_COLUMNS = 3;

/** A number field that holds money: shown with ₹ and Indian grouping. */
const MONEY = /price|fee|charge|cost|amount|rate|mrp|tariff|₹|rupee/i;

function isMoney(field: FieldDef): boolean {
  return field.type === "number" && MONEY.test(`${field.key} ${field.label}`);
}

function cellText(field: FieldDef, value: unknown): string {
  if (isMoney(field) && typeof value === "number") {
    return `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  }
  return formatAttribute(field, value);
}

export default async function CustomPageList({
  params,
  searchParams,
}: PageProps<"/data/[entityType]">) {
  const user = await requireAdmin();
  const { entityType } = await params;
  if (isSystemEntityType(entityType)) notFound();

  const definition = await getDefinition(user.clinicId, entityType);
  if (!definition || definition.kind !== "custom" || definition.archived) notFound();

  const { q, filters } = parseFilterParams(await searchParams);
  const fields = activeFields(definition.fields);
  const records = await listRecords(user.clinicId, entityType, {
    q,
    titleField: definition.titleField,
    fields,
    filters,
  });
  const titleField = fields.find((f) => f.key === definition.titleField) ?? null;
  const columns = fields
    .filter((f) => f.key !== definition.titleField && f.type !== "longtext")
    .slice(0, SUMMARY_COLUMNS);
  const basePath = `/data/${entityType}`;
  const filtered = Boolean(q) || Object.keys(filters).length > 0;
  const noun = definition.singularLabel.toLowerCase();
  const plural = definition.label.toLowerCase();

  return (
    <PageShell>
      <PageHeader
        title={records.length > 0 && !filtered ? `${definition.label} · ${records.length}` : definition.label}
      >
        {definition.agentEnabled ? (
          <span className="bg-agent-soft text-agent-text inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Agent reads this page
          </span>
        ) : (
          <span className="bg-sunken text-ink-2 inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium">
            <EyeOff className="size-3.5" aria-hidden="true" />
            Hidden from agent
          </span>
        )}
        <Button asChild>
          <Link href={`${basePath}/new`}>
            <Plus />
            Add {noun}
          </Link>
        </Button>
      </PageHeader>

      <div className="bg-surface border-line mt-6 overflow-hidden rounded-xl border">
        {(records.length > 0 || filtered) && (
          <ListFilters
            basePath={basePath}
            fields={fields}
            q={q}
            filters={filters}
            searchPlaceholder={`Search ${titleField?.label.toLowerCase() ?? "title"}`}
            className="border-line border-b p-3"
          />
        )}

        {records.length === 0 ? (
          filtered ? (
            <EmptyState
              icon={SearchX}
              tone="none"
              title="Nothing matches these filters"
              action={
                <Button variant="outline" asChild>
                  <Link href={basePath}>Clear filters</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={FileText}
              title={`No ${plural} yet`}
              action={
                <Button asChild>
                  <Link href={`${basePath}/new`}>
                    <Plus />
                    Add {noun}
                  </Link>
                </Button>
              }
            >
              {definition.agentEnabled
                ? `Add ${plural} so the agent can answer patients who ask about them.`
                : `Add ${plural} for staff to look up here.`}
            </EmptyState>
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{titleField?.label ?? "Title"}</TableHead>
                {columns.map((f) => (
                  <TableHead key={f.key} className={cn(f.type === "number" && "text-right")}>
                    {f.label}
                  </TableHead>
                ))}
                <TableHead className="text-right">
                  {definition.agentEnabled ? "Agent uses it" : "Active"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const title = titleField
                  ? formatAttribute(titleField, record.attributes[titleField.key])
                  : record.id;
                return (
                  <TableRow key={record.id} className={cn("relative", !record.isActive && "text-ink-3")}>
                    <TableCell className="max-w-80 truncate">
                      <Link
                        href={`${basePath}/${record.id}`}
                        className={cn(
                          "font-medium after:absolute after:inset-0 after:content-['']",
                          record.isActive ? "text-ink" : "text-ink-3",
                        )}
                      >
                        {title}
                      </Link>
                    </TableCell>
                    {columns.map((f) => (
                      <TableCell
                        key={f.key}
                        className={cn("max-w-64 truncate", f.type === "number" && "tnum text-right")}
                      >
                        {cellText(f, record.attributes[f.key])}
                      </TableCell>
                    ))}
                    <TableCell className="text-right">
                      {/* Above the row's link overlay so the switch stays clickable. */}
                      <span className="relative z-10 inline-flex">
                        <ActiveToggle
                          target={{ kind: "record", entityType, id: record.id }}
                          isActive={record.isActive}
                          label={title}
                        />
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </PageShell>
  );
}
