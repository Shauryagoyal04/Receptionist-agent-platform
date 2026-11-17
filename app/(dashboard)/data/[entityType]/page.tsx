import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Database, Plus, SearchX } from "lucide-react";

import { PageHeader, PageShell } from "@/components/page-header";
import { ActiveToggle } from "@/components/clinic-data/active-toggle";
import { ListFilters, parseFilterParams } from "@/components/clinic-data/list-filters";
import { EmptyState } from "@/components/clinic-data/states";
import { Badge } from "@/components/ui/badge";
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
import { formatAttribute } from "@/lib/clinic-data/format";
import { activeFields, isSystemEntityType } from "@/lib/clinic-data/model";
import { listRecords } from "@/lib/data/clinic-records";
import { getDefinition } from "@/lib/data/definitions";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Clinic page" };

/** Columns after the title: up to three short, active fields. */
const SUMMARY_COLUMNS = 3;

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

  return (
    <PageShell>
      <PageHeader
        title={definition.label}
        description={definition.description || undefined}
      >
        {!definition.agentEnabled && <Badge variant="outline">Hidden from agent</Badge>}
        <Button asChild>
          <Link href={`${basePath}/new`}>
            <Plus />
            Add {definition.singularLabel.toLowerCase()}
          </Link>
        </Button>
      </PageHeader>

      <div className="mt-6">
        <ListFilters
          basePath={basePath}
          fields={fields}
          q={q}
          filters={filters}
          searchPlaceholder={`Search ${titleField?.label.toLowerCase() ?? "title"}`}
        />
      </div>

      <Card className="mt-4 overflow-hidden py-0">
        {records.length === 0 ? (
          filtered ? (
            <EmptyState icon={SearchX} title="Nothing matches these filters" />
          ) : (
            <EmptyState
              icon={Database}
              title={`No ${definition.label.toLowerCase()} yet`}
              action={
                <Button size="sm" asChild>
                  <Link href={`${basePath}/new`}>Add the first one</Link>
                </Button>
              }
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{titleField?.label ?? "Title"}</TableHead>
                {columns.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
                <TableHead className="pr-4 text-right">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => {
                const title = titleField
                  ? formatAttribute(titleField, record.attributes[titleField.key])
                  : record.id;
                return (
                  <TableRow
                    key={record.id}
                    className={cn(!record.isActive && "text-muted-foreground")}
                  >
                    <TableCell className="pl-4 font-medium">
                      <Link href={`${basePath}/${record.id}`} className="hover:underline">
                        {title}
                      </Link>
                    </TableCell>
                    {columns.map((f) => (
                      <TableCell key={f.key} className="max-w-64 truncate">
                        {formatAttribute(f, record.attributes[f.key])}
                      </TableCell>
                    ))}
                    <TableCell className="pr-4 text-right">
                      <ActiveToggle
                        target={{ kind: "record", entityType, id: record.id }}
                        isActive={record.isActive}
                        label={title}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>
    </PageShell>
  );
}
