"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  ListPlus,
  Loader2,
  Lock,
  Pencil,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/clinic-data/form-bits";
import { RegionEmpty } from "@/components/analytics/panel";
import { FIELD_TYPE_ICON } from "@/components/clinic-data/settings/page-visuals";
import { cn } from "@/lib/utils";
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
      className="flex flex-col gap-5"
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
      <p className="text-ink text-[15px] font-semibold">
        {mode === "add" ? "New field" : `Edit ${initial.label}`}
      </p>
      <div className="grid gap-5 sm:grid-cols-3">
        <FormField id={`${idp}-label`} label="Label" required error={errors.label} hint="What staff see next to the input.">
          <Input
            id={`${idp}-label`}
            className="h-11"
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
            className="h-11 font-mono"
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
            className="[&_select]:h-11"
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
          hint="Shown under the input to whoever fills it in."
          className="sm:col-span-3"
        >
          <Input
            id={`${idp}-description`}
            className="h-11"
            placeholder="Yes if the patient must not eat for 10 hours before the test."
            value={field.description}
            onChange={(e) => setField((f) => ({ ...f, description: e.target.value }))}
          />
        </FormField>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <FlagSwitch
          id={`${idp}-required`}
          label="Required"
          hint="Staff must fill it in before saving."
          checked={field.required}
          onChange={(required) => setField((f) => ({ ...f, required }))}
        />
        <FlagSwitch
          id={`${idp}-agentVisible`}
          label="Visible to agent"
          hint={staffOnly ? "Patient fields are staff-only." : "The agent can read it out to patients."}
          checked={staffOnly ? false : field.agentVisible}
          disabled={staffOnly}
          onChange={(agentVisible) => setField((f) => ({ ...f, agentVisible }))}
        />
        <FlagSwitch
          id={`${idp}-filterable`}
          label="Filter on list"
          hint="Adds a filter for it on the list page."
          checked={field.filterable}
          onChange={(filterable) => setField((f) => ({ ...f, filterable }))}
        />
        <FlagSwitch
          id={`${idp}-pii`}
          label="Personal data"
          hint="Kept private; never sent to the agent."
          checked={field.pii}
          onChange={(pii) => setField((f) => ({ ...f, pii }))}
        />
      </div>
      {!staffOnly && field.pii && field.agentVisible && (
        <p className="text-ink-3 text-[13px]">
          Personal data is never sent to the agent, even when marked visible.
        </p>
      )}

      {error && (
        <p role="alert" className="text-danger-text text-[13px]">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} className="min-w-28">
          {pending && <Loader2 className="animate-spin" />}
          {mode === "add" ? "Add field" : "Save field"}
        </Button>
      </div>
    </form>
  );
}

function FlagSwitch({
  id,
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "border-line flex items-start gap-3 rounded-[10px] border px-3 py-2.5 transition-colors duration-(--dur-quick)",
        disabled ? "opacity-60" : "hover:border-line-strong cursor-pointer",
      )}
    >
      <Switch id={id} className="mt-0.5" checked={checked} disabled={disabled} onCheckedChange={onChange} />
      <span className="min-w-0">
        <span className="text-ink block text-sm font-medium">{label}</span>
        <span className="text-ink-3 block text-[13px] leading-[18px]">{hint}</span>
      </span>
    </label>
  );
}

function Chip({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "agent" | "outline" }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs whitespace-nowrap",
        tone === "agent" && "bg-agent-soft text-agent-text font-medium",
        tone === "neutral" && "bg-sunken text-ink-2",
        tone === "outline" && "border-line text-ink-2 border",
      )}
    >
      {children}
    </span>
  );
}

function FieldFlags({ field, isTitle, staffOnly }: { field: FieldDef; isTitle: boolean; staffOnly: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip tone="outline">{FIELD_TYPE_LABELS[field.type]}</Chip>
      {isTitle && <Chip>Names each row</Chip>}
      {field.required && <Chip>Required</Chip>}
      {!staffOnly && isAgentVisible(field) && <Chip tone="agent">Agent reads it</Chip>}
      {field.pii && (
        <Chip>
          <Lock className="size-3" aria-hidden="true" />
          Personal
        </Chip>
      )}
      {field.filterable && <Chip>Filter</Chip>}
    </div>
  );
}

function TypeWell({ type, muted }: { type: FieldType; muted?: boolean }) {
  const Icon = FIELD_TYPE_ICON[type];
  return (
    <span
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-[10px]",
        muted ? "bg-sunken text-ink-4" : "bg-sunken text-ink-2",
      )}
      title={FIELD_TYPE_LABELS[type]}
    >
      <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
    </span>
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

  const startAdding = () => {
    resetForm();
    setEditing(null);
    setAdding(true);
  };

  return (
    <section aria-labelledby="fields-title" className="bg-surface border-line rounded-xl border">
      <header className="border-line flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-5 py-4">
        <div className="min-w-0 flex-1">
          <h2 id="fields-title" className="text-ink text-[17px] leading-6 font-semibold">
            {staffOnly ? "Extra fields" : "Fields"}
          </h2>
          <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">
            {staffOnly
              ? "What staff record about each patient, beyond the built-in details."
              : "What staff fill in for each row, in the order they see it."}
          </p>
        </div>
        <div className="flex w-48 items-center gap-3" title="Archived fields count towards the limit">
          <span className="bg-sunken h-1.5 flex-1 overflow-hidden rounded-full">
            <span
              className="bg-agent block h-full rounded-full"
              style={{ width: `${Math.min(100, (fields.length / MAX_FIELDS) * 100)}%` }}
            />
          </span>
          <span className="tnum text-ink-3 shrink-0 text-xs">
            {fields.length} of {MAX_FIELDS}
          </span>
        </div>
        {!adding && active.length > 0 && (
          <Button variant="outline" disabled={full || isPending} onClick={startAdding}>
            <Plus />
            Add field
          </Button>
        )}
      </header>

      {active.length === 0 && !adding && (
        <div className="px-5 py-6">
          <RegionEmpty icon={ListPlus} title="No fields yet.">
            <p>Add the details staff should keep for each row, like price, duration or who it&apos;s for.</p>
            <Button className="mt-3" disabled={full || isPending} onClick={startAdding}>
              <Plus />
              Add the first field
            </Button>
          </RegionEmpty>
        </div>
      )}

      <ol>
        {active.map((field, index) =>
          editing === field.key ? (
            <li key={field.key} className="border-line bg-sunken/40 border-t px-5 py-5 first:border-t-0">
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
                      success: `${next.label || field.label} saved`,
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
              className="border-line flex flex-col gap-3 border-t px-5 py-4 first:border-t-0 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {/* Order controls: always visible (not hover-only) so they
                    work on touch and with a keyboard. */}
                <div className="flex shrink-0 flex-col">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${field.label} up`}
                    disabled={isPending || index === 0}
                    onClick={() => run((v) => moveField(entityType, v, field.key, "up"))}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Move ${field.label} down`}
                    disabled={isPending || index === active.length - 1}
                    onClick={() => run((v) => moveField(entityType, v, field.key, "down"))}
                  >
                    <ArrowDown />
                  </Button>
                </div>
                <TypeWell type={field.type} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-ink truncate text-[15px] font-medium">{field.label}</span>
                    <span className="text-ink-4 font-mono text-xs">{field.key}</span>
                  </p>
                  {field.description && (
                    <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">{field.description}</p>
                  )}
                  <div className="mt-2">
                    <FieldFlags field={field} isTitle={field.key === titleField} staffOnly={staffOnly} />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1 pl-[88px] sm:pl-0">
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
                  title={field.key === titleField ? "The field that names each row can't be archived" : undefined}
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
      </ol>

      {adding && (
        <div className="border-line bg-sunken/40 border-t px-5 py-5">
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
        </div>
      )}

      {(full || (isPending && !adding && editing === null)) && (
        <p className="border-line text-ink-3 flex items-center gap-2 border-t px-5 py-3 text-[13px]" aria-live="polite">
          {isPending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {full ? `This page has reached ${MAX_FIELDS} fields, including archived ones.` : "Saving…"}
        </p>
      )}

      {archived.length > 0 && (
        <details className="group/archived border-line border-t">
          <summary className="text-ink-3 hover:text-ink-2 flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[13px] font-medium transition-colors duration-(--dur-quick) [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 transition-transform duration-(--dur-base) group-open/archived:rotate-90"
            />
            Archived fields ({archived.length})
          </summary>
          <ul>
            {archived.map((field) => (
              <li
                key={field.key}
                className="border-line flex items-center gap-3 border-t px-5 py-3"
              >
                <TypeWell type={field.type} muted />
                <div className="min-w-0 flex-1">
                  <p className="text-ink-2 truncate text-sm">{field.label}</p>
                  <p className="text-ink-4 font-mono text-xs">
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
    </section>
  );
}
