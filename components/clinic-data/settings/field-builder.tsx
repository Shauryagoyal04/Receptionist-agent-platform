"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField, SaveBar } from "@/components/clinic-data/form-bits";
import {
  addField,
  moveField,
  setFieldArchived,
  updateField,
  type FieldInput,
} from "@/lib/clinic-data/actions";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  MAX_FIELDS,
  isAgentVisible,
  suggestFieldKey,
  type FieldDef,
  type FieldType,
} from "@/lib/clinic-data/model";

/*
 * Field builder for one page (contract §2.2).
 *
 * - Key and type are chosen once; afterwards they're shown read-only.
 * - Fields are archived, never removed, and can be restored.
 * - Every action sends the definition version the admin is looking at, so a
 *   concurrent edit by another admin is refused rather than overwritten.
 */

type Result = { ok: true; data: { version: number } } | { ok: false; error: string; fieldErrors?: Record<string, string> };

function useDefinitionAction(initialVersion: number) {
  const [version, setVersion] = useState(initialVersion);
  const [syncedFrom, setSyncedFrom] = useState(initialVersion);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // A server refresh with a newer version wins over the local copy.
  if (initialVersion !== syncedFrom) {
    setSyncedFrom(initialVersion);
    setVersion(initialVersion);
  }

  function run(
    call: (version: number) => Promise<Result>,
    options: { success?: string; onError?: (result: Extract<Result, { ok: false }>) => void; onOk?: () => void } = {},
  ) {
    startTransition(async () => {
      const result = await call(version);
      if (result.ok) {
        setVersion(result.data.version);
        if (options.success) toast.success(options.success);
        options.onOk?.();
        router.refresh();
      } else if (options.onError) {
        options.onError(result);
      } else {
        toast.error(result.error);
      }
    });
  }
  return { run, isPending };
}

const EMPTY_FIELD: FieldInput = {
  key: "",
  label: "",
  type: "text",
  required: false,
  options: [],
  description: "",
  agentVisible: true,
  filterable: false,
  pii: false,
};

function FieldEditor({
  mode,
  initial,
  staffOnly,
  pending,
  error,
  errors,
  onSubmit,
  onCancel,
}: {
  mode: "add" | "edit";
  initial: FieldInput;
  staffOnly: boolean;
  pending: boolean;
  error: string | null;
  errors: Record<string, string>;
  onSubmit: (field: FieldInput) => void;
  onCancel: () => void;
}) {
  const [field, setField] = useState<FieldInput>(initial);
  const [keyTouched, setKeyTouched] = useState(mode === "edit");
  const [optionsText, setOptionsText] = useState(initial.options.join("\n"));
  const needsOptions = field.type === "select" || field.type === "multiselect";
  const idp = mode === "add" ? "new-field" : `edit-${initial.key}`;

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({
          ...field,
          options: needsOptions
            ? optionsText.split("\n").map((o) => o.trim()).filter(Boolean)
            : [],
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField id={`${idp}-label`} label="Label" required error={errors.label}>
          <Input
            id={`${idp}-label`}
            value={field.label}
            placeholder="Fasting required"
            onChange={(e) => {
              const label = e.target.value;
              setField((f) => ({
                ...f,
                label,
                key: keyTouched ? f.key : suggestFieldKey(label),
              }));
            }}
          />
        </FormField>
        <FormField
          id={`${idp}-key`}
          label="Key"
          required
          error={errors.key}
          hint={mode === "add" ? "Permanent. camelCase." : "Can't be changed."}
        >
          <Input
            id={`${idp}-key`}
            value={field.key}
            readOnly={mode === "edit"}
            disabled={mode === "edit"}
            className="font-mono"
            onChange={(e) => {
              setKeyTouched(true);
              setField((f) => ({ ...f, key: e.target.value }));
            }}
          />
        </FormField>
        <FormField
          id={`${idp}-type`}
          label="Type"
          required
          error={errors.type}
          hint={mode === "add" ? "Permanent." : "Can't be changed. Archive and add a new field instead."}
        >
          <NativeSelect
            id={`${idp}-type`}
            value={field.type}
            disabled={mode === "edit"}
            onChange={(e) => setField((f) => ({ ...f, type: e.target.value as FieldType }))}
          >
            {FIELD_TYPES.map((type) => (
              <option key={type} value={type}>
                {FIELD_TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        </FormField>

        {needsOptions && (
          <FormField
            id={`${idp}-options`}
            label="Options"
            required
            error={errors.options ?? Object.entries(errors).find(([k]) => k.startsWith("options."))?.[1]}
            hint="One per line. Removing one keeps it on rows that already use it."
            className="sm:col-span-3"
          >
            <Textarea
              id={`${idp}-options`}
              rows={4}
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              className="resize-y"
            />
          </FormField>
        )}

        <FormField
          id={`${idp}-description`}
          label="Help text"
          error={errors.description}
          hint="Shown under the input. Optional."
          className="sm:col-span-3"
        >
          <Input
            id={`${idp}-description`}
            value={field.description}
            onChange={(e) => setField((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3">
        <FlagSwitch
          id={`${idp}-required`}
          label="Required"
          checked={field.required}
          onChange={(required) => setField((f) => ({ ...f, required }))}
        />
        <FlagSwitch
          id={`${idp}-agentVisible`}
          label="Visible to agent"
          checked={staffOnly ? false : field.agentVisible}
          disabled={staffOnly}
          onChange={(agentVisible) => setField((f) => ({ ...f, agentVisible }))}
        />
        <FlagSwitch
          id={`${idp}-filterable`}
          label="Filter on list"
          checked={field.filterable}
          onChange={(filterable) => setField((f) => ({ ...f, filterable }))}
        />
        <FlagSwitch
          id={`${idp}-pii`}
          label="Personal data"
          checked={field.pii}
          onChange={(pii) => setField((f) => ({ ...f, pii }))}
        />
      </div>
      {staffOnly ? (
        <p className="text-muted-foreground text-xs">
          Patient fields are staff-only; the agent never reads them.
        </p>
      ) : field.pii && field.agentVisible ? (
        <p className="text-muted-foreground text-xs">
          Personal data is never sent to the agent, even when marked visible.
        </p>
      ) : null}

      <SaveBar pending={pending} error={error} label={mode === "add" ? "Add field" : "Save field"}>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </SaveBar>
    </form>
  );
}

function FlagSwitch({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2 text-sm">
      <Switch id={id} size="sm" checked={checked} disabled={disabled} onCheckedChange={onChange} />
      {label}
    </label>
  );
}

function FieldFlags({ field, isTitle, staffOnly }: { field: FieldDef; isTitle: boolean; staffOnly: boolean }) {
  return (
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline">{FIELD_TYPE_LABELS[field.type]}</Badge>
      {isTitle && <Badge variant="secondary">Title</Badge>}
      {field.required && <Badge variant="secondary">Required</Badge>}
      {!staffOnly && isAgentVisible(field) && (
        <Badge className="bg-status-booked-tint text-status-booked">Agent</Badge>
      )}
      {field.pii && <Badge className="bg-status-abandoned-tint text-status-abandoned">Personal</Badge>}
      {field.filterable && <Badge variant="secondary">Filter</Badge>}
    </div>
  );
}

export function FieldBuilder({
  entityType,
  version: serverVersion,
  fields,
  titleField,
  staffOnly,
}: {
  entityType: string;
  version: number;
  fields: FieldDef[];
  titleField: string | null;
  staffOnly: boolean;
}) {
  const { run, isPending } = useDefinitionAction(serverVersion);
  const [editing, setEditing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const ordered = fields.slice().sort((a, b) => a.order - b.order);
  const active = ordered.filter((f) => !f.archived);
  const archived = ordered.filter((f) => f.archived);
  const full = fields.length >= MAX_FIELDS;

  function resetForm() {
    setFormError(null);
    setFormErrors({});
  }

  const onFormError = (result: { error: string; fieldErrors?: Record<string, string> }) => {
    setFormError(result.error);
    setFormErrors(result.fieldErrors ?? {});
  };

  return (
    <Card className="py-0">
      <CardHeader className="border-b py-4">
        <CardTitle>Fields</CardTitle>
        <CardDescription>
          {fields.length} of {MAX_FIELDS} fields used (archived fields count).
        </CardDescription>
      </CardHeader>

      <CardContent className="px-0">
        {active.length === 0 && !adding && (
          <p className="text-muted-foreground px-4 py-8 text-center text-sm">
            No fields yet. Add one to start collecting information here.
          </p>
        )}

        <ul className="divide-y">
          {active.map((field, index) =>
            editing === field.key ? (
              <li key={field.key} className="bg-muted/30 px-4 py-4">
                <FieldEditor
                  mode="edit"
                  staffOnly={staffOnly}
                  initial={{
                    key: field.key,
                    label: field.label,
                    type: field.type,
                    required: field.required,
                    options: field.options,
                    description: field.description,
                    agentVisible: field.agentVisible,
                    filterable: field.filterable,
                    pii: field.pii,
                  }}
                  pending={isPending}
                  error={formError}
                  errors={formErrors}
                  onCancel={() => {
                    setEditing(null);
                    resetForm();
                  }}
                  onSubmit={(next) => {
                    resetForm();
                    run(
                      (version) =>
                        updateField(entityType, version, field.key, {
                          label: next.label,
                          description: next.description,
                          required: next.required,
                          options: next.options,
                          agentVisible: next.agentVisible,
                          filterable: next.filterable,
                          pii: next.pii,
                        }),
                      {
                        success: "Field saved",
                        onOk: () => setEditing(null),
                        onError: onFormError,
                      },
                    );
                  }}
                />
              </li>
            ) : (
              <li
                key={field.key}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{field.label}</p>
                  <p className="text-muted-foreground font-mono text-xs">{field.key}</p>
                  {field.description && (
                    <p className="text-muted-foreground mt-0.5 text-xs">{field.description}</p>
                  )}
                  <div className="mt-1.5">
                    <FieldFlags field={field} isTitle={field.key === titleField} staffOnly={staffOnly} />
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${field.label} up`}
                    disabled={isPending || index === 0}
                    onClick={() => run((v) => moveField(entityType, v, field.key, "up"))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Move ${field.label} down`}
                    disabled={isPending || index === active.length - 1}
                    onClick={() => run((v) => moveField(entityType, v, field.key, "down"))}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      resetForm();
                      setAdding(false);
                      setEditing(field.key);
                    }}
                  >
                    <Pencil />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending || field.key === titleField}
                    title={field.key === titleField ? "The title field can't be archived" : undefined}
                    onClick={() =>
                      run((v) => setFieldArchived(entityType, v, field.key, true), {
                        success: `${field.label} archived`,
                      })
                    }
                  >
                    <Archive />
                    Archive
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>

        <div className="border-t px-4 py-4">
          {adding ? (
            <FieldEditor
              mode="add"
              staffOnly={staffOnly}
              initial={{ ...EMPTY_FIELD, agentVisible: !staffOnly }}
              pending={isPending}
              error={formError}
              errors={formErrors}
              onCancel={() => {
                setAdding(false);
                resetForm();
              }}
              onSubmit={(next) => {
                resetForm();
                run((version) => addField(entityType, version, next), {
                  success: `${next.label || "Field"} added`,
                  onOk: () => setAdding(false),
                  onError: onFormError,
                });
              }}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled={full || isPending}
                onClick={() => {
                  resetForm();
                  setEditing(null);
                  setAdding(true);
                }}
              >
                <Plus />
                Add field
              </Button>
              {isPending && <Loader2 className="text-muted-foreground size-4 animate-spin" />}
              {full && (
                <p className="text-muted-foreground text-xs">
                  This page has reached {MAX_FIELDS} fields.
                </p>
              )}
            </div>
          )}
        </div>

        {archived.length > 0 && (
          <details className="border-t">
            <summary className="text-muted-foreground cursor-pointer px-4 py-3 text-sm">
              Archived fields ({archived.length})
            </summary>
            <ul className="divide-y border-t">
              {archived.map((field) => (
                <li
                  key={field.key}
                  className="flex flex-col gap-2 px-4 py-3 opacity-70 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm">{field.label}</p>
                    <p className="text-muted-foreground font-mono text-xs">
                      {field.key} · {FIELD_TYPE_LABELS[field.type]}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      run((v) => setFieldArchived(entityType, v, field.key, false), {
                        success: `${field.label} restored`,
                      })
                    }
                  >
                    <ArchiveRestore />
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </CardContent>
    </Card>
  );
}
