import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { activeFields, type FieldDef } from "@/lib/clinic-data/model";

/*
 * Search plus one filter per `filterable` field (contract §2.2), as a plain
 * GET form: the URL is the state, it works before hydration, and a filtered
 * list can be shared as a link.
 *
 * Filter params are `f_<key>`, which can't collide with `q` because field
 * keys are camelCase and contain no underscore.
 */

export const FILTER_PREFIX = "f_";

export function parseFilterParams(
  raw: Record<string, string | string[] | undefined>,
): { q: string | null; filters: Record<string, string> } {
  const filters: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!name.startsWith(FILTER_PREFIX)) continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) filters[name.slice(FILTER_PREFIX.length)] = v;
  }
  const q = Array.isArray(raw.q) ? raw.q[0] : raw.q;
  return { q: q?.trim() || null, filters };
}

export function ListFilters({
  basePath,
  fields,
  q,
  filters,
  searchPlaceholder,
}: {
  basePath: string;
  fields: FieldDef[];
  q: string | null;
  filters: Record<string, string>;
  searchPlaceholder: string;
}) {
  const filterable = activeFields(fields).filter((field) => field.filterable);
  const active = Boolean(q) || Object.keys(filters).length > 0;

  return (
    <form
      method="get"
      action={basePath}
      role="search"
      className="flex flex-wrap items-end gap-2"
    >
      <div className="relative w-full sm:w-64">
        <Search
          aria-hidden
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
        />
        <Input
          name="q"
          type="search"
          defaultValue={q ?? ""}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="pl-8"
        />
      </div>

      {filterable.map((field) => {
        const name = `${FILTER_PREFIX}${field.key}`;
        const value = filters[field.key] ?? "";
        const control =
          field.type === "boolean" ? (
            <NativeSelect name={name} defaultValue={value} aria-label={field.label}>
              <option value="">{field.label}: any</option>
              <option value="true">{field.label}: yes</option>
              <option value="false">{field.label}: no</option>
            </NativeSelect>
          ) : field.type === "select" || field.type === "multiselect" ? (
            <NativeSelect name={name} defaultValue={value} aria-label={field.label}>
              <option value="">{field.label}: any</option>
              {field.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </NativeSelect>
          ) : (
            <Input
              name={name}
              type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
              step={field.type === "number" ? "any" : undefined}
              defaultValue={value}
              placeholder={field.label}
              aria-label={field.label}
            />
          );
        return (
          <div key={field.key} className="w-full sm:w-48">
            {control}
          </div>
        );
      })}

      <div className="flex gap-2">
        <Button type="submit" variant="outline">
          Apply
        </Button>
        {active && (
          <Button variant="ghost" asChild>
            <Link href={basePath}>Clear</Link>
          </Button>
        )}
      </div>
    </form>
  );
}
