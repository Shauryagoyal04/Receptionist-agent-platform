"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField, ToggleChip } from "@/components/clinic-data/form-bits";
import {
  activeFields,
  type Attributes,
  type FieldDef,
} from "@/lib/clinic-data/model";

/*
 * Inputs generated from a page definition (contract §2.3).
 *
 * Form state keeps what the control naturally produces — numbers as the
 * typed string, so "1." or "-" can be typed — and `toSubmitValues` converts
 * to the stored encoding just before submit. The server validates again.
 */

export type FormValue = string | boolean | string[];
export type FormValues = Record<string, FormValue>;

export function toFormValues(fields: FieldDef[], stored: Attributes): FormValues {
  const out: FormValues = {};
  for (const field of activeFields(fields)) {
    const value = stored[field.key];
    switch (field.type) {
      case "boolean":
        out[field.key] = value === true;
        break;
      case "multiselect":
      case "tags":
        out[field.key] = Array.isArray(value)
          ? value.filter((v): v is string => typeof v === "string")
          : typeof value === "string" && value
            ? [value]
            : [];
        break;
      default:
        out[field.key] =
          typeof value === "string" || typeof value === "number" ? String(value) : "";
    }
  }
  return out;
}

export function toSubmitValues(fields: FieldDef[], values: FormValues): Attributes {
  const out: Attributes = {};
  for (const field of activeFields(fields)) {
    const value = values[field.key];
    if (field.type === "number" && typeof value === "string") {
      const trimmed = value.trim();
      // An unparseable entry is sent as-is so the server can say why.
      out[field.key] =
        trimmed === "" ? null : Number.isFinite(Number(trimmed)) ? Number(trimmed) : trimmed;
    } else {
      out[field.key] = value ?? null;
    }
  }
  return out;
}

function TagInput({
  id,
  value,
  onChange,
  invalid,
}: {
  id: string;
  value: string[];
  onChange: (next: string[]) => void;
  invalid: boolean;
}) {
  const [draft, setDraft] = useState("");

  function commit() {
    const tag = draft.trim().replace(/,$/, "").trim();
    if (tag && !value.includes(tag)) onChange([...value, tag]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
          {value.map((tag) => (
            <li
              key={tag}
              className="bg-muted flex h-6 items-center gap-1 rounded-md pr-1 pl-2 text-xs"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="text-muted-foreground hover:text-foreground rounded p-0.5"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        aria-invalid={invalid || undefined}
        placeholder="Type and press Enter"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            commit();
          } else if (event.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}

export function FieldInput({
  field,
  value,
  onChange,
  error,
  idPrefix = "attr",
}: {
  field: FieldDef;
  value: FormValue | undefined;
  onChange: (next: FormValue) => void;
  error?: string;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.key}`;
  const invalid = Boolean(error);
  const describedBy = error ? `${id}-error` : undefined;
  const text = typeof value === "string" ? value : "";
  const list = Array.isArray(value) ? value : [];

  let control: React.ReactNode;
  switch (field.type) {
    case "longtext":
      control = (
        <Textarea
          id={id}
          rows={3}
          maxLength={5000}
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className="resize-y"
        />
      );
      break;
    case "boolean":
      control = (
        <div className="flex h-8 items-center gap-2">
          <Switch
            id={id}
            checked={value === true}
            aria-describedby={describedBy}
            onCheckedChange={(checked) => onChange(checked)}
          />
          <span className="text-muted-foreground text-sm">
            {value === true ? "Yes" : "No"}
          </span>
        </div>
      );
      break;
    case "select": {
      const removed = text && !field.options.includes(text);
      control = (
        <NativeSelect
          id={id}
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{field.required ? "Choose…" : "—"}</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          {removed && <option value={text}>{text} (removed option)</option>}
        </NativeSelect>
      );
      break;
    }
    case "multiselect": {
      const extra = list.filter((v) => !field.options.includes(v));
      control = (
        <div
          id={id}
          role="group"
          aria-describedby={describedBy}
          className="flex flex-wrap gap-1.5"
        >
          {[...field.options, ...extra].map((option) => (
            <ToggleChip
              key={option}
              pressed={list.includes(option)}
              muted={extra.includes(option)}
              onPressedChange={(pressed) =>
                onChange(
                  pressed ? [...list, option] : list.filter((v) => v !== option),
                )
              }
            >
              {option}
              {extra.includes(option) && " (removed)"}
            </ToggleChip>
          ))}
        </div>
      );
      break;
    }
    case "tags":
      control = <TagInput id={id} value={list} onChange={onChange} invalid={invalid} />;
      break;
    default: {
      const inputType =
        field.type === "number"
          ? "number"
          : field.type === "date"
            ? "date"
            : field.type === "email"
              ? "email"
              : field.type === "phone"
                ? "tel"
                : field.type === "url"
                  ? "url"
                  : "text";
      control = (
        <Input
          id={id}
          type={inputType}
          inputMode={field.type === "number" ? "decimal" : undefined}
          step={field.type === "number" ? "any" : undefined}
          maxLength={field.type === "text" ? 500 : undefined}
          placeholder={field.type === "url" ? "https://" : undefined}
          value={text}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
        />
      );
    }
  }

  return (
    <FormField
      id={id}
      label={field.label}
      required={field.required}
      hint={field.description || undefined}
      error={error}
      className={field.type === "longtext" || field.type === "multiselect" || field.type === "tags" ? "sm:col-span-2" : undefined}
    >
      {control}
    </FormField>
  );
}

/** Every active field of a definition, in order, as a two-column grid. */
export function AttributeFields({
  fields,
  values,
  onChange,
  errors,
}: {
  fields: FieldDef[];
  values: FormValues;
  onChange: (key: string, value: FormValue) => void;
  errors: Record<string, string>;
}) {
  const visible = activeFields(fields);
  if (visible.length === 0) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {visible.map((field) => (
        <FieldInput
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(value) => onChange(field.key, value)}
          error={errors[`attributes.${field.key}`]}
        />
      ))}
    </div>
  );
}
