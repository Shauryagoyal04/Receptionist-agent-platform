import { z } from "zod";

/*
 * Configurable clinic data — the shapes in docs/clinic-data-contract.md.
 *
 * Client-safe on purpose: the forms render from these types and the server
 * validates with the same builders, so what the UI accepts and what the
 * database receives cannot drift. Nothing here touches MongoDB.
 */

/* ------------------------------------------------------------------ */
/* Vocabulary                                                          */
/* ------------------------------------------------------------------ */

export const FIELD_TYPES = [
  "text",
  "longtext",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "tags",
  "email",
  "phone",
  "url",
] as const;
export const fieldTypeSchema = z.enum(FIELD_TYPES);
export type FieldType = z.infer<typeof fieldTypeSchema>;

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: "Text",
  longtext: "Long text",
  number: "Number",
  boolean: "Yes / no",
  date: "Date",
  select: "Single choice",
  multiselect: "Multiple choice",
  tags: "Tags",
  email: "Email",
  phone: "Phone",
  url: "Link",
};

export const SYSTEM_ENTITY_TYPES = ["clinic", "doctor", "patient"] as const;
export type SystemEntityType = (typeof SYSTEM_ENTITY_TYPES)[number];

export function isSystemEntityType(value: string): value is SystemEntityType {
  return (SYSTEM_ENTITY_TYPES as readonly string[]).includes(value);
}

/** Labels for the system pages; their definitions only add fields. */
export const SYSTEM_PAGES: Record<
  SystemEntityType,
  { label: string; singularLabel: string; href: string; description: string }
> = {
  clinic: {
    label: "Clinic",
    singularLabel: "Clinic",
    href: "/clinic",
    description: "Name, timings, address and anything else about the clinic.",
  },
  doctor: {
    label: "Doctors",
    singularLabel: "Doctor",
    href: "/doctors",
    description: "Who patients can book, when, and for how long.",
  },
  patient: {
    label: "Patients",
    singularLabel: "Patient",
    href: "/patients",
    description: "People who have contacted the clinic. Extras are staff-only.",
  },
};

export const ENTITY_TYPE_RE = /^[a-z][a-z0-9_]{1,39}$/;
export const FIELD_KEY_RE = /^[a-z][a-zA-Z0-9]{0,39}$/;
export const MAX_FIELDS = 50;

export const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const GENDERS = ["Male", "Female", "Other"] as const;
export type Gender = (typeof GENDERS)[number];

/* ------------------------------------------------------------------ */
/* Definitions                                                         */
/* ------------------------------------------------------------------ */

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
  description: string;
  agentVisible: boolean;
  filterable: boolean;
  pii: boolean;
  archived: boolean;
  order: number;
};

export type EntityDefinition = {
  clinicId: string;
  entityType: string;
  kind: "system" | "custom";
  label: string;
  singularLabel: string;
  description: string;
  agentEnabled: boolean;
  /** Custom pages only. */
  titleField: string | null;
  fields: FieldDef[];
  version: number;
  archived: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** False when this is a synthesized empty system definition. */
  persisted: boolean;
  /** False when a stored field couldn't be read; such a page is read-only. */
  intact: boolean;
};

/** Active (non-archived) fields in display order. */
export function activeFields(fields: FieldDef[]): FieldDef[] {
  return fields
    .filter((field) => !field.archived)
    .sort((a, b) => a.order - b.order);
}

/** What the agent would see (contract §2.2). */
export function isAgentVisible(field: FieldDef): boolean {
  return field.agentVisible && !field.pii && !field.archived;
}

/* ------------------------------------------------------------------ */
/* Field and definition validation (contract §2)                       */
/* ------------------------------------------------------------------ */

const trimmed = (max: number) => z.string().trim().max(max);

const optionsSchema = z
  .array(trimmed(100).min(1, "Options can't be blank."))
  .max(100, "At most 100 options.")
  .refine(
    (values) => new Set(values).size === values.length,
    "Options must be unique.",
  );

export const fieldDefSchema = z
  .object({
    key: z
      .string()
      .regex(
        FIELD_KEY_RE,
        "Key must start with a lowercase letter and use only letters and digits (camelCase), up to 40 characters.",
      ),
    label: trimmed(80).min(1, "Label is required."),
    type: fieldTypeSchema,
    required: z.boolean(),
    options: optionsSchema,
    description: trimmed(500),
    agentVisible: z.boolean(),
    filterable: z.boolean(),
    pii: z.boolean(),
    archived: z.boolean(),
    order: z.number().int().min(0),
  })
  .superRefine((field, ctx) => {
    const needsOptions = field.type === "select" || field.type === "multiselect";
    if (needsOptions && field.options.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Add at least one option.",
      });
    }
    if (!needsOptions && field.options.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "Only choice fields have options.",
      });
    }
  });

export const definitionMetaSchema = z.object({
  label: trimmed(60).min(1, "Label is required."),
  singularLabel: trimmed(60).min(1, "Singular label is required."),
  description: trimmed(1000),
  agentEnabled: z.boolean(),
});

/**
 * A whole definition as it will be stored. Run on every write, against the
 * full next state rather than the patch, so an invariant cannot be broken by
 * two individually-valid edits.
 */
export const definitionSchema = z
  .object({
    entityType: z
      .string()
      .regex(
        ENTITY_TYPE_RE,
        "Slug must start with a lowercase letter and use only lowercase letters, digits and underscores (2-40 characters).",
      ),
    kind: z.enum(["system", "custom"]),
    label: trimmed(60).min(1, "Label is required."),
    singularLabel: trimmed(60).min(1, "Singular label is required."),
    description: trimmed(1000),
    agentEnabled: z.boolean(),
    titleField: z.string().nullable(),
    fields: z
      .array(fieldDefSchema)
      .max(MAX_FIELDS, `A page can have at most ${MAX_FIELDS} fields, including archived ones.`),
    archived: z.boolean(),
  })
  .superRefine((def, ctx) => {
    const system = isSystemEntityType(def.entityType);
    if (system !== (def.kind === "system")) {
      ctx.addIssue({
        code: "custom",
        path: ["entityType"],
        message: system
          ? `"${def.entityType}" is a built-in page.`
          : "Only clinic, doctor and patient are built-in pages.",
      });
    }

    const seen = new Set<string>();
    def.fields.forEach((field, index) => {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["fields", index, "key"],
          message: `A field with key "${field.key}" already exists (keys stay reserved after archiving).`,
        });
      }
      seen.add(field.key);
    });

    if (def.kind === "custom") {
      const title = def.fields.find((field) => field.key === def.titleField);
      if (!title || title.type !== "text" || !title.required || title.archived) {
        ctx.addIssue({
          code: "custom",
          path: ["titleField"],
          message: "The title field must be a required, active text field.",
        });
      }
    } else {
      if (def.titleField !== null) {
        ctx.addIssue({
          code: "custom",
          path: ["titleField"],
          message: "Built-in pages don't have a title field.",
        });
      }
      if (def.archived) {
        ctx.addIssue({
          code: "custom",
          path: ["archived"],
          message: "Built-in pages can't be removed.",
        });
      }
    }
  });
export type DefinitionInput = z.input<typeof definitionSchema>;

/**
 * Immutability rules (§2.1, §2.2): the slug, and each field's key and type,
 * never change once stored, and fields are never removed from the array.
 * Returns the first violation as a sentence, or null.
 */
export function immutabilityViolation(
  stored: Pick<EntityDefinition, "entityType" | "fields">,
  next: Pick<EntityDefinition, "entityType" | "fields">,
): string | null {
  if (stored.entityType !== next.entityType) {
    return "A page's slug can't be changed.";
  }
  for (const before of stored.fields) {
    const after = next.fields.find((field) => field.key === before.key);
    if (!after) {
      return `Field "${before.key}" can't be removed; archive it instead.`;
    }
    if (after.type !== before.type) {
      return `Field "${before.key}" can't change type. Archive it and add a new field.`;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Attribute values (contract §2.3)                                    */
/* ------------------------------------------------------------------ */

export type AttributeValue = string | number | boolean | string[] | null;
export type Attributes = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Validator for a single present (non-empty) value of a field. */
function valueSchema(field: FieldDef, stored: unknown): z.ZodType<AttributeValue> {
  // A removed option stays valid on the record that already holds it
  // (§2.2: "existing records keep the old value"), so re-saving an
  // unrelated edit doesn't force staff to change it.
  const keptOptions = new Set<string>(field.options);
  if (typeof stored === "string") keptOptions.add(stored);
  if (Array.isArray(stored)) {
    for (const item of stored) if (typeof item === "string") keptOptions.add(item);
  }
  const option = z
    .string()
    .refine((value) => keptOptions.has(value), "Pick one of the listed options.");

  switch (field.type) {
    case "text":
      return z.string().trim().min(1).max(500, "At most 500 characters.");
    case "longtext":
      return z.string().trim().min(1).max(5000, "At most 5000 characters.");
    case "number":
      return z.number({ error: "Enter a number." }).finite("Enter a number.");
    case "boolean":
      return z.boolean();
    case "date":
      return z.string().refine(isRealDate, "Use a valid date (YYYY-MM-DD).");
    case "select":
      return option;
    case "multiselect":
      return z
        .array(option)
        .min(1)
        .refine((v) => new Set(v).size === v.length, "Each option once.");
    case "tags":
      return z
        .array(z.string().trim().min(1).max(100, "Tags are at most 100 characters."))
        .min(1)
        .max(100, "At most 100 tags.")
        .refine((v) => new Set(v).size === v.length, "Each tag once.");
    case "email":
      return z.email("Enter a valid email address.").max(320);
    case "phone":
      return z
        .string()
        .trim()
        .max(40, "At most 40 characters.")
        .regex(/^[0-9+()\-.\s]*[0-9][0-9+()\-.\s]*$/, "Enter a phone number.");
    case "url":
      return z
        .url({ protocol: /^https?$/, error: "Enter a link starting with http:// or https://." })
        .max(2000);
  }
}

/** Empty-looking form values collapse to null so they can be omitted. */
function normalizeEmpty(value: unknown): unknown {
  if (value === undefined || value === null) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  if (Array.isArray(value) && value.length === 0) return null;
  if (typeof value === "number" && Number.isNaN(value)) return null;
  return value;
}

export type AttributesWrite = {
  /** Keys to set, with values in their stored encoding. */
  set: Record<string, Exclude<AttributeValue, null>>;
  /** Keys to remove (non-required fields left empty). */
  unset: string[];
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; fieldErrors: Record<string, string> };

/**
 * Validates submitted attribute values against a definition's active fields.
 *
 * Only active fields are written; archived fields and unknown keys are left
 * as they are in the stored document (the caller writes with `$set` /
 * `$unset` on individual `attributes.<key>` paths), so hidden data is kept.
 */
export function validateAttributes(
  fields: FieldDef[],
  input: unknown,
  stored: Attributes = {},
): ValidationResult<AttributesWrite> {
  const values =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  const errors: Record<string, string> = {};
  const write: AttributesWrite = { set: {}, unset: [] };

  for (const field of activeFields(fields)) {
    const raw = normalizeEmpty(values[field.key]);
    if (raw === null) {
      if (field.required) errors[field.key] = `${field.label} is required.`;
      else write.unset.push(field.key);
      continue;
    }
    const parsed = valueSchema(field, stored[field.key]).safeParse(raw);
    if (!parsed.success) {
      errors[field.key] = parsed.error.issues[0]?.message ?? "Invalid value.";
      continue;
    }
    if (parsed.data !== null) write.set[field.key] = parsed.data;
  }

  return Object.keys(errors).length > 0
    ? { ok: false, fieldErrors: errors }
    : { ok: true, data: write };
}

/**
 * Builds a zod schema for an `attributes` object from a definition — the
 * declarative form of `validateAttributes`, for callers that want to compose
 * it into a larger object schema.
 */
export function buildAttributesSchema(fields: FieldDef[], stored: Attributes = {}) {
  const shape: Record<string, z.ZodType> = {};
  for (const field of activeFields(fields)) {
    const base = valueSchema(field, stored[field.key]);
    shape[field.key] = z.preprocess(
      normalizeEmpty,
      field.required ? base : base.nullable(),
    );
  }
  return z.object(shape);
}

/* ------------------------------------------------------------------ */
/* Core fields of the system pages (contract §3)                       */
/* ------------------------------------------------------------------ */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .transform((value) => (value === "" ? null : value))
    .nullable();

export const clinicCoreSchema = z.object({
  clinicName: z.string().trim().min(1, "Clinic name is required.").max(200),
  timings: optionalText(300),
  address: optionalText(500),
  phone: optionalText(40),
});
export type ClinicCore = z.infer<typeof clinicCoreSchema>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * The agent adds "Dr." itself and matches on the bare name, so a leading
 * "Dr" / "Dr." / "Doctor" typed by staff is removed rather than rejected.
 */
export function stripDoctorPrefix(name: string): string {
  return name.replace(/^\s*(dr\.?|doctor)\s+/i, "").trim();
}

export const doctorCoreSchema = z
  .object({
    name: z
      .string()
      .transform(stripDoctorPrefix)
      .pipe(z.string().min(1, "Name is required.").max(120)),
    specialization: z.string().trim().max(120),
    // Google Calendar the agent adds this doctor's appointments to ("" = no sync).
    // The doctor must share that calendar with the clinic's service account.
    calendarEmail: z
      .string()
      .trim()
      .toLowerCase()
      .max(254)
      .refine((value) => value === "" || z.email().safeParse(value).success, {
        message: "Enter a valid email, or leave blank.",
      }),
    isActive: z.boolean(),
    availableDays: z
      .array(z.enum(WEEKDAYS))
      .min(1, "Pick at least one day.")
      .transform((days) => WEEKDAYS.filter((day) => days.includes(day))),
    workingHours: z.object({
      start: z.string().regex(HHMM, "Use HH:mm (24h)."),
      end: z.string().regex(HHMM, "Use HH:mm (24h)."),
    }),
    consultationDuration: z
      .number({ error: "Enter minutes per slot." })
      .int("Whole minutes only.")
      .min(5, "At least 5 minutes.")
      .max(480, "At most 480 minutes."),
  })
  .superRefine((doctor, ctx) => {
    const { start, end } = doctor.workingHours;
    if (HHMM.test(start) && HHMM.test(end)) {
      if (end <= start) {
        ctx.addIssue({
          code: "custom",
          path: ["workingHours", "end"],
          message: "End time must be after start time.",
        });
      } else {
        const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
        if (toMin(end) - toMin(start) < doctor.consultationDuration) {
          ctx.addIssue({
            code: "custom",
            path: ["consultationDuration"],
            message: "Working hours are shorter than one slot.",
          });
        }
      }
    }
  });
export type DoctorCore = z.infer<typeof doctorCoreSchema>;

/** WhatsApp `from` format: digits with country code, no "+". */
export function normalizePatientPhone(value: string): string {
  return value.replace(/[\s\-().]/g, "").replace(/^\+/, "");
}

export const patientCoreSchema = z.object({
  phone: z
    .string()
    .transform(normalizePatientPhone)
    .pipe(
      z
        .string()
        .regex(/^\d{8,15}$/, "Digits with country code, e.g. 919876543210."),
    ),
  name: z.string().trim().min(1, "Name is required.").max(120),
  age: z
    .number({ error: "Enter an age in years." })
    .int("Whole years only.")
    .min(0)
    .max(130)
    .nullable(),
  gender: z.enum(GENDERS).nullable(),
});
export type PatientCore = z.infer<typeof patientCoreSchema>;

/** Flattens zod issues to `{ "a.b": message }`, first message per path. */
export function issuesToFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

/** Turns "Lab tests" into "lab_tests" as a slug suggestion. */
export function suggestSlug(label: string): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40);
  return slug;
}

/** Turns "Fasting required" into "fastingRequired" as a key suggestion. */
export function suggestFieldKey(label: string): string {
  const words = label
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const key = words
    .map((word, index) =>
      index === 0
        ? word.toLowerCase()
        : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join("")
    .replace(/^[^a-z]+/, "")
    .slice(0, 40);
  return key;
}
