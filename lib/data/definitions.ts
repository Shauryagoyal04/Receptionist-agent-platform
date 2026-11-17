import "server-only";

import { type Collection, type Document } from "mongodb";
import { z } from "zod";

import { getDb } from "@/lib/mongodb";
import {
  FIELD_TYPES,
  SYSTEM_PAGES,
  definitionSchema,
  immutabilityViolation,
  isSystemEntityType,
  issuesToFieldErrors,
  type EntityDefinition,
  type FieldDef,
  type FieldType,
} from "@/lib/clinic-data/model";
import { nullableIsoDate } from "@/lib/types";

/*
 * `entity_definitions` (contract §2): which pages and fields a clinic has.
 *
 * The console writes these; the agent re-reads them every 60s. Every query
 * is filtered by the clinicId the caller passes, which callers take from the
 * session, never from the request.
 *
 * The collection name lives here rather than in `COLLECTIONS` in
 * lib/mongodb.ts so this feature doesn't touch that file.
 */
export const DEFINITIONS_COLLECTION = "entity_definitions";

async function collection(): Promise<Collection<Document>> {
  return (await getDb()).collection(DEFINITIONS_COLLECTION);
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const bool = (fallback: boolean) =>
  z.boolean().nullish().transform((value) => value ?? fallback);
const str = z.string().nullish().transform((value) => value ?? "");

/** Lenient field reader: a malformed field degrades, it never throws. */
const storedFieldSchema = z.object({
  key: z.string(),
  label: z.string().nullish(),
  type: z.string(),
  required: bool(false),
  options: z
    .array(z.unknown())
    .nullish()
    .transform((values) =>
      (values ?? []).filter((v): v is string => typeof v === "string"),
    ),
  description: str,
  agentVisible: bool(false),
  filterable: bool(false),
  pii: bool(false),
  archived: bool(false),
  order: z.number().nullish(),
});

function toField(raw: unknown, index: number): FieldDef | null {
  const parsed = storedFieldSchema.safeParse(raw);
  if (!parsed.success) return null;
  const f = parsed.data;
  // A type this console doesn't know (written by a newer version) can't be
  // rendered or validated; the definition is then marked not intact and
  // refuses writes rather than corrupting the field.
  if (!(FIELD_TYPES as readonly string[]).includes(f.type)) return null;
  return {
    key: f.key,
    label: f.label || f.key,
    type: f.type as FieldType,
    required: f.required,
    options: f.options,
    description: f.description,
    agentVisible: f.agentVisible,
    filterable: f.filterable,
    pii: f.pii,
    archived: f.archived,
    order: typeof f.order === "number" ? f.order : index,
  };
}

function toDefinition(doc: Document): EntityDefinition {
  const entityType = String(doc.entityType);
  const system = isSystemEntityType(entityType);
  const rawFields: unknown[] = Array.isArray(doc.fields) ? doc.fields : [];
  const fields = rawFields
    .map((raw, index) => toField(raw, index))
    .filter((f): f is FieldDef => f !== null);
  const fallback = system ? SYSTEM_PAGES[entityType] : null;
  return {
    clinicId: String(doc.clinicId),
    entityType,
    kind: system ? "system" : "custom",
    label:
      typeof doc.label === "string" && doc.label ? doc.label : fallback?.label ?? entityType,
    singularLabel:
      typeof doc.singularLabel === "string" && doc.singularLabel
        ? doc.singularLabel
        : fallback?.singularLabel ?? entityType,
    description: typeof doc.description === "string" ? doc.description : "",
    agentEnabled: doc.agentEnabled === true,
    titleField:
      !system && typeof doc.titleField === "string" ? doc.titleField : null,
    fields,
    version: typeof doc.version === "number" ? doc.version : 0,
    archived: doc.archived === true,
    createdAt: nullableIsoDate.safeParse(doc.createdAt).data ?? null,
    updatedAt: nullableIsoDate.safeParse(doc.updatedAt).data ?? null,
    updatedBy: typeof doc.updatedBy === "string" ? doc.updatedBy : null,
    persisted: true,
    intact: fields.length === rawFields.length,
  };
}

/** A system page with no stored definition yet: `fields: []` (§2.1). */
export function emptySystemDefinition(
  clinicId: string,
  entityType: keyof typeof SYSTEM_PAGES,
): EntityDefinition {
  const page = SYSTEM_PAGES[entityType];
  return {
    clinicId,
    entityType,
    kind: "system",
    label: page.label,
    singularLabel: page.singularLabel,
    description: "",
    agentEnabled: false,
    titleField: null,
    fields: [],
    version: 0,
    archived: false,
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
    persisted: false,
    intact: true,
  };
}

/**
 * Every definition for a clinic. System pages are always present (synthesized
 * when not stored); archived custom pages only when asked for.
 */
export async function listDefinitions(
  clinicId: string,
  options: { includeArchived?: boolean } = {},
): Promise<{ system: EntityDefinition[]; custom: EntityDefinition[] }> {
  const docs = await (await collection())
    .find({ clinicId })
    .sort({ label: 1 })
    .toArray();
  const defs = docs.map(toDefinition);

  const system = (["clinic", "doctor", "patient"] as const).map(
    (type) =>
      defs.find((def) => def.entityType === type) ??
      emptySystemDefinition(clinicId, type),
  );
  const custom = defs.filter(
    (def) => def.kind === "custom" && (options.includeArchived || !def.archived),
  );
  return { system, custom };
}

/** Lightweight list for navigation. */
export async function listCustomPagesForNav(
  clinicId: string,
): Promise<{ entityType: string; label: string }[]> {
  const docs = await (await collection())
    .find(
      { clinicId, archived: { $ne: true }, entityType: { $nin: ["clinic", "doctor", "patient"] } },
      { projection: { entityType: 1, label: 1 } },
    )
    .sort({ label: 1 })
    .toArray();
  return docs.map((doc) => ({
    entityType: String(doc.entityType),
    label: typeof doc.label === "string" && doc.label ? doc.label : String(doc.entityType),
  }));
}

/**
 * One definition, or null. System types fall back to the empty definition;
 * archived custom types are returned (callers decide whether to show them).
 */
export async function getDefinition(
  clinicId: string,
  entityType: string,
): Promise<EntityDefinition | null> {
  const doc = await (await collection()).findOne({ clinicId, entityType });
  if (doc) return toDefinition(doc);
  if (isSystemEntityType(entityType)) {
    return emptySystemDefinition(clinicId, entityType);
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export type DefinitionWriteResult =
  | { ok: true; definition: EntityDefinition }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** The persisted shape, in contract field order. */
function toStoredFields(fields: FieldDef[]): Document[] {
  return fields.map((field) => ({
    key: field.key,
    label: field.label,
    type: field.type,
    required: field.required,
    options: field.options,
    description: field.description,
    agentVisible: field.agentVisible,
    filterable: field.filterable,
    pii: field.pii,
    archived: field.archived,
    order: field.order,
  }));
}

/**
 * Validates and writes the next state of a definition.
 *
 * `stored` is what the caller read (null for a brand-new custom page). The
 * write is conditional on the stored `version`, so two admins editing the
 * same page can't silently overwrite each other: the second gets a conflict
 * and reloads.
 */
export async function saveDefinition(
  clinicId: string,
  userId: string,
  stored: EntityDefinition | null,
  next: EntityDefinition,
): Promise<DefinitionWriteResult> {
  const parsed = definitionSchema.safeParse({
    entityType: next.entityType,
    kind: next.kind,
    label: next.label,
    singularLabel: next.singularLabel,
    description: next.description,
    agentEnabled: next.agentEnabled,
    titleField: next.titleField,
    fields: next.fields,
    archived: next.archived,
  });
  if (!parsed.success) {
    const fieldErrors = issuesToFieldErrors(parsed.error);
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "That page couldn't be saved.",
      fieldErrors,
    };
  }

  if (stored && !stored.intact) {
    return {
      ok: false,
      error:
        "This page has fields this console version doesn't recognise, so it can't be edited here.",
    };
  }

  if (stored) {
    const violation = immutabilityViolation(stored, parsed.data);
    if (violation) return { ok: false, error: violation };
  }

  const data = parsed.data;
  const now = new Date().toISOString();
  const body: Document = {
    clinicId,
    entityType: data.entityType,
    kind: data.kind,
    label: data.label,
    singularLabel: data.singularLabel,
    description: data.description,
    agentEnabled: data.kind === "custom" ? data.agentEnabled : false,
    fields: toStoredFields(data.fields),
    archived: data.archived,
    updatedAt: now,
    updatedBy: userId,
  };
  if (data.kind === "custom") body.titleField = data.titleField;

  const col = await collection();

  if (!stored || !stored.persisted) {
    try {
      await col.insertOne({ ...body, version: 1, createdAt: now });
    } catch (error) {
      if (isDuplicateKey(error)) {
        return {
          ok: false,
          error: stored
            ? "Someone else just changed this page. Reload and try again."
            : `A page with the slug "${data.entityType}" already exists (archived pages keep their slug).`,
          fieldErrors: stored ? undefined : { entityType: "Already in use." },
        };
      }
      throw error;
    }
  } else {
    const result = await col.updateOne(
      {
        clinicId,
        entityType: stored.entityType,
        // A hand-written doc may have no version; `null` also matches missing.
        version: stored.version === 0 ? { $in: [0, null] } : stored.version,
      },
      { $set: { ...body, version: stored.version + 1 } },
    );
    if (result.matchedCount === 0) {
      return {
        ok: false,
        error: "Someone else just changed this page. Reload and try again.",
      };
    }
  }

  const fresh = await getDefinition(clinicId, data.entityType);
  if (!fresh) throw new Error("Definition vanished after write");
  return { ok: true, definition: fresh };
}

export function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
