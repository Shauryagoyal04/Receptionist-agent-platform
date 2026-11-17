"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentUser, type SessionUser } from "@/lib/auth/session";
import {
  FIELD_KEY_RE,
  clinicCoreSchema,
  doctorCoreSchema,
  fieldTypeSchema,
  isSystemEntityType,
  issuesToFieldErrors,
  patientCoreSchema,
  validateAttributes,
  type EntityDefinition,
  type FieldDef,
} from "@/lib/clinic-data/model";
import {
  getDefinition,
  saveDefinition,
  type DefinitionWriteResult,
} from "@/lib/data/definitions";
import {
  createDoctor,
  createRecord,
  getClinicRecord,
  getDoctor,
  getPatient,
  getRecord,
  saveClinicRecord,
  setDoctorActive,
  setRecordActive,
  updateDoctor,
  updatePatient,
  updateRecord,
} from "@/lib/data/clinic-records";

/*
 * Writes for configurable clinic data (docs/clinic-data-contract.md).
 *
 * Same rules as lib/conversations/actions.ts: every action re-checks the
 * session itself (Server Functions are POSTs anyone can send), takes the
 * clinicId only from that session, validates its input with zod, and returns
 * expected failures instead of throwing so forms can show them inline.
 *
 * Roles: everything here is admin-only. Staff only get Analytics,
 * Conversations and Escalations (docs/staff-handoff-contract.md).
 */

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? object : { data: T }))
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const SESSION_EXPIRED = { ok: false, error: "Your session expired. Sign in again." } as const;
const ADMIN_ONLY = { ok: false, error: "Only admins can change pages and fields." } as const;
const ADMIN_ONLY_DATA = { ok: false, error: "Only admins can change clinic data." } as const;
const GENERIC = "Couldn't save that. Try again.";

type Fail = { ok: false; error: string; fieldErrors?: Record<string, string> };

async function requireUser(): Promise<SessionUser | null> {
  return getCurrentUser();
}

function fail(error: string, fieldErrors?: Record<string, string>): Fail {
  return { ok: false, error, fieldErrors };
}

function prefixErrors(prefix: string, errors: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(errors).map(([key, message]) => [`${prefix}.${key}`, message]),
  );
}

/* ------------------------------------------------------------------ */
/* Definitions (admin)                                                 */
/* ------------------------------------------------------------------ */

function revalidateDefinitionPaths(entityType: string) {
  // The layout carries the nav, which lists custom pages.
  revalidatePath("/", "layout");
  revalidatePath("/settings/data");
  revalidatePath(`/settings/data/${entityType}`);
}

/** Loads the stored definition and checks the client saw the latest version. */
async function loadForEdit(
  user: SessionUser,
  entityType: string,
  expectedVersion: number,
): Promise<{ ok: true; def: EntityDefinition } | Fail> {
  if (typeof entityType !== "string" || typeof expectedVersion !== "number") {
    return fail("That page couldn't be found.");
  }
  let def: EntityDefinition | null;
  try {
    def = await getDefinition(user.clinicId, entityType);
  } catch (error) {
    console.error("[clinic-data] getDefinition failed", error);
    return fail(GENERIC);
  }
  if (!def) return fail("That page couldn't be found.");
  if (def.version !== expectedVersion) {
    return fail("Someone else just changed this page. Reload and try again.");
  }
  return { ok: true, def };
}

async function commit(
  user: SessionUser,
  stored: EntityDefinition | null,
  next: EntityDefinition,
): Promise<ActionResult<{ version: number }>> {
  let result: DefinitionWriteResult;
  try {
    result = await saveDefinition(user.clinicId, user.id, stored, next);
  } catch (error) {
    console.error("[clinic-data] saveDefinition failed", error);
    return fail(GENERIC);
  }
  if (!result.ok) return fail(result.error, result.fieldErrors);
  revalidateDefinitionPaths(next.entityType);
  return { ok: true, data: { version: result.definition.version } };
}

const createPageSchema = z.object({
  entityType: z.string(),
  label: z.string(),
  singularLabel: z.string(),
  description: z.string(),
  agentEnabled: z.boolean(),
  titleLabel: z.string().trim().min(1, "Title field label is required.").max(80),
  titleKey: z.string().regex(FIELD_KEY_RE, "Use camelCase, e.g. name."),
});

/**
 * Creates a custom page together with its title field, since a custom page
 * must always have a required text title field (§2).
 */
export async function createCustomPage(
  input: z.input<typeof createPageSchema>,
): Promise<ActionResult<{ entityType: string }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;

  const parsed = createPageSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Check the highlighted fields.", issuesToFieldErrors(parsed.error));
  }
  const data = parsed.data;
  if (isSystemEntityType(data.entityType)) {
    return fail("That slug is reserved.", { entityType: "Reserved for a built-in page." });
  }

  const titleField: FieldDef = {
    key: data.titleKey,
    label: data.titleLabel,
    type: "text",
    required: true,
    options: [],
    description: "",
    agentVisible: true,
    filterable: false,
    pii: false,
    archived: false,
    order: 0,
  };
  const next: EntityDefinition = {
    clinicId: user.clinicId,
    entityType: data.entityType,
    kind: "custom",
    label: data.label,
    singularLabel: data.singularLabel,
    description: data.description,
    agentEnabled: data.agentEnabled,
    titleField: titleField.key,
    fields: [titleField],
    version: 0,
    archived: false,
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
    persisted: false,
    intact: true,
  };
  const result = await commit(user, null, next);
  if (!result.ok) return result;
  return { ok: true, data: { entityType: data.entityType } };
}

const metaSchema = z.object({
  label: z.string(),
  singularLabel: z.string(),
  description: z.string(),
  agentEnabled: z.boolean(),
  titleField: z.string().nullable(),
});

export async function updatePageMeta(
  entityType: string,
  expectedVersion: number,
  input: z.input<typeof metaSchema>,
): Promise<ActionResult<{ version: number }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;
  const parsed = metaSchema.safeParse(input);
  if (!parsed.success) return fail("That page couldn't be saved.");

  const loaded = await loadForEdit(user, entityType, expectedVersion);
  if (!loaded.ok) return loaded;
  const { def } = loaded;
  if (def.kind === "system") {
    // Built-in pages keep their names; only their fields are configurable.
    return fail("Built-in pages can't be renamed.");
  }
  return commit(user, def, {
    ...def,
    label: parsed.data.label,
    singularLabel: parsed.data.singularLabel,
    description: parsed.data.description,
    agentEnabled: parsed.data.agentEnabled,
    titleField: parsed.data.titleField,
  });
}

export async function setPageArchived(
  entityType: string,
  expectedVersion: number,
  archived: boolean,
): Promise<ActionResult<{ version: number }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;
  if (typeof archived !== "boolean") return fail(GENERIC);

  const loaded = await loadForEdit(user, entityType, expectedVersion);
  if (!loaded.ok) return loaded;
  if (loaded.def.kind === "system") return fail("Built-in pages can't be removed.");
  const result = await commit(user, loaded.def, { ...loaded.def, archived });
  if (result.ok) revalidatePath(`/data/${entityType}`, "layout");
  return result;
}

const fieldInputSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: fieldTypeSchema,
  required: z.boolean(),
  options: z.array(z.string()),
  description: z.string(),
  agentVisible: z.boolean(),
  filterable: z.boolean(),
  pii: z.boolean(),
});
export type FieldInput = z.input<typeof fieldInputSchema>;

/** Patient extras are staff-only (§3): the agent never reads them. */
function agentVisibleFor(def: EntityDefinition, requested: boolean): boolean {
  return def.entityType === "patient" ? false : requested;
}

function cleanOptions(options: string[]): string[] {
  return options.map((option) => option.trim()).filter(Boolean);
}

export async function addField(
  entityType: string,
  expectedVersion: number,
  input: FieldInput,
): Promise<ActionResult<{ version: number }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;
  const parsed = fieldInputSchema.safeParse(input);
  if (!parsed.success) return fail("Check the highlighted fields.", issuesToFieldErrors(parsed.error));

  const loaded = await loadForEdit(user, entityType, expectedVersion);
  if (!loaded.ok) return loaded;
  const { def } = loaded;
  const f = parsed.data;
  const needsOptions = f.type === "select" || f.type === "multiselect";
  const field: FieldDef = {
    key: f.key,
    label: f.label,
    type: f.type,
    required: f.required,
    options: needsOptions ? cleanOptions(f.options) : [],
    description: f.description,
    agentVisible: agentVisibleFor(def, f.agentVisible),
    filterable: f.filterable,
    pii: f.pii,
    archived: false,
    order: def.fields.reduce((max, existing) => Math.max(max, existing.order), -1) + 1,
  };
  const result = await commit(user, def, { ...def, fields: [...def.fields, field] });
  if (!result.ok && result.fieldErrors) {
    // Re-key "fields.N.key" errors on the new field to the form's input names.
    const index = def.fields.length;
    const mapped: Record<string, string> = {};
    for (const [path, message] of Object.entries(result.fieldErrors)) {
      const match = path.match(/^fields\.(\d+)\.(.+)$/);
      if (match && Number(match[1]) === index) mapped[match[2]] = message;
    }
    return { ...result, fieldErrors: mapped };
  }
  return result;
}

const fieldPatchSchema = fieldInputSchema
  .omit({ key: true, type: true })
  .partial();

/** Edits everything about a field except its key and type (§2.2). */
export async function updateField(
  entityType: string,
  expectedVersion: number,
  key: string,
  patch: z.input<typeof fieldPatchSchema>,
): Promise<ActionResult<{ version: number }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;
  const parsed = fieldPatchSchema.strict().safeParse(patch);
  if (!parsed.success) return fail("Key and type can't be changed after a field is created.");

  const loaded = await loadForEdit(user, entityType, expectedVersion);
  if (!loaded.ok) return loaded;
  const { def } = loaded;
  const index = def.fields.findIndex((field) => field.key === key);
  if (index === -1) return fail("That field couldn't be found.");

  const before = def.fields[index];
  const p = parsed.data;
  const after: FieldDef = {
    ...before,
    ...(p.label !== undefined && { label: p.label }),
    ...(p.description !== undefined && { description: p.description }),
    ...(p.required !== undefined && { required: p.required }),
    ...(p.filterable !== undefined && { filterable: p.filterable }),
    ...(p.pii !== undefined && { pii: p.pii }),
    ...(p.options !== undefined && { options: cleanOptions(p.options) }),
    ...(p.agentVisible !== undefined && {
      agentVisible: agentVisibleFor(def, p.agentVisible),
    }),
  };
  const fields = def.fields.slice();
  fields[index] = after;
  const result = await commit(user, def, { ...def, fields });
  if (!result.ok && result.fieldErrors) {
    const mapped: Record<string, string> = {};
    for (const [path, message] of Object.entries(result.fieldErrors)) {
      const match = path.match(/^fields\.(\d+)\.(.+)$/);
      if (match && Number(match[1]) === index) mapped[match[2]] = message;
    }
    return { ...result, fieldErrors: mapped };
  }
  return result;
}

export async function setFieldArchived(
  entityType: string,
  expectedVersion: number,
  key: string,
  archived: boolean,
): Promise<ActionResult<{ version: number }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;
  if (typeof archived !== "boolean") return fail(GENERIC);

  const loaded = await loadForEdit(user, entityType, expectedVersion);
  if (!loaded.ok) return loaded;
  const { def } = loaded;
  if (archived && def.titleField === key) {
    return fail("This is the page's title field. Pick another title field first.");
  }
  const fields = def.fields.map((field) =>
    field.key === key ? { ...field, archived } : field,
  );
  if (!def.fields.some((field) => field.key === key)) {
    return fail("That field couldn't be found.");
  }
  return commit(user, def, { ...def, fields });
}

/** Moves a field one place up or down among the active fields. */
export async function moveField(
  entityType: string,
  expectedVersion: number,
  key: string,
  direction: "up" | "down",
): Promise<ActionResult<{ version: number }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY;
  if (direction !== "up" && direction !== "down") return fail(GENERIC);

  const loaded = await loadForEdit(user, entityType, expectedVersion);
  if (!loaded.ok) return loaded;
  const { def } = loaded;

  // Renumber everything 0..n-1 in current order, then swap neighbours.
  const ordered = def.fields
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((field, order) => ({ ...field, order }));
  const active = ordered.filter((field) => !field.archived);
  const at = active.findIndex((field) => field.key === key);
  if (at === -1) return fail("That field couldn't be found.");
  const swapWith = direction === "up" ? at - 1 : at + 1;
  if (swapWith < 0 || swapWith >= active.length) return { ok: true, data: { version: def.version } };
  const a = active[at];
  const b = active[swapWith];
  const orderA = a.order;
  a.order = b.order;
  b.order = orderA;

  // Keep the array in its stored order; only `order` values change.
  const byKey = new Map(ordered.map((field) => [field.key, field]));
  const fields = def.fields.map((field) => byKey.get(field.key) ?? field);
  return commit(user, def, { ...def, fields });
}

/* ------------------------------------------------------------------ */
/* Records (admin + staff)                                             */
/* ------------------------------------------------------------------ */

async function activeDefinition(
  user: SessionUser,
  entityType: string,
): Promise<EntityDefinition | null> {
  const def = await getDefinition(user.clinicId, entityType);
  if (!def || def.archived) return null;
  return def;
}

const clinicInputSchema = z.object({
  core: z.unknown(),
  attributes: z.unknown(),
});

export async function saveClinicInfo(
  input: z.input<typeof clinicInputSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY_DATA;
  const shape = clinicInputSchema.safeParse(input);
  if (!shape.success) return fail(GENERIC);

  const core = clinicCoreSchema.safeParse(shape.data.core);
  try {
    const [def, stored] = await Promise.all([
      activeDefinition(user, "clinic"),
      getClinicRecord(user.clinicId),
    ]);
    const attrs = validateAttributes(def?.fields ?? [], shape.data.attributes, stored.attributes);
    if (!core.success || !attrs.ok) {
      return fail("Check the highlighted fields.", {
        ...(core.success ? {} : issuesToFieldErrors(core.error)),
        ...(attrs.ok ? {} : prefixErrors("attributes", attrs.fieldErrors)),
      });
    }
    await saveClinicRecord(user.clinicId, core.data, attrs.data);
  } catch (error) {
    console.error("[clinic-data] saveClinicInfo failed", error);
    return fail(GENERIC);
  }
  revalidatePath("/clinic");
  return { ok: true };
}

const recordInputSchema = z.object({
  core: z.unknown(),
  attributes: z.unknown(),
});

export async function saveDoctor(
  id: string | null,
  input: z.input<typeof recordInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY_DATA;
  const shape = recordInputSchema.safeParse(input);
  if (!shape.success || (id !== null && typeof id !== "string")) return fail(GENERIC);

  const core = doctorCoreSchema.safeParse(shape.data.core);
  let savedId: string;
  try {
    const def = await activeDefinition(user, "doctor");
    const existing = id ? await getDoctor(user.clinicId, id) : null;
    if (id && !existing) return fail("That doctor couldn't be found.");
    const attrs = validateAttributes(
      def?.fields ?? [],
      shape.data.attributes,
      existing?.attributes,
    );
    if (!core.success || !attrs.ok) {
      return fail("Check the highlighted fields.", {
        ...(core.success ? {} : issuesToFieldErrors(core.error)),
        ...(attrs.ok ? {} : prefixErrors("attributes", attrs.fieldErrors)),
      });
    }
    if (id) {
      const found = await updateDoctor(user.clinicId, id, core.data, attrs.data);
      if (!found) return fail("That doctor couldn't be found.");
      savedId = id;
    } else {
      savedId = await createDoctor(user.clinicId, core.data, attrs.data);
    }
  } catch (error) {
    console.error("[clinic-data] saveDoctor failed", error);
    return fail(GENERIC);
  }
  revalidatePath("/doctors");
  revalidatePath(`/doctors/${savedId}`);
  return { ok: true, data: { id: savedId } };
}

export async function setDoctorActiveFlag(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY_DATA;
  if (typeof id !== "string" || typeof isActive !== "boolean") return fail(GENERIC);
  try {
    const found = await setDoctorActive(user.clinicId, id, isActive);
    if (!found) return fail("That doctor couldn't be found.");
  } catch (error) {
    console.error("[clinic-data] setDoctorActiveFlag failed", error);
    return fail(GENERIC);
  }
  revalidatePath("/doctors");
  revalidatePath(`/doctors/${id}`);
  return { ok: true };
}

export async function savePatient(
  id: string,
  input: z.input<typeof recordInputSchema>,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY_DATA;
  const shape = recordInputSchema.safeParse(input);
  if (!shape.success || typeof id !== "string") return fail(GENERIC);

  const core = patientCoreSchema.safeParse(shape.data.core);
  try {
    const existing = await getPatient(user.clinicId, id);
    if (!existing) return fail("That patient couldn't be found.");
    const def = await activeDefinition(user, "patient");
    const attrs = validateAttributes(
      def?.fields ?? [],
      shape.data.attributes,
      existing.attributes,
    );
    if (!core.success || !attrs.ok) {
      return fail("Check the highlighted fields.", {
        ...(core.success ? {} : issuesToFieldErrors(core.error)),
        ...(attrs.ok ? {} : prefixErrors("attributes", attrs.fieldErrors)),
      });
    }
    const result = await updatePatient(user.clinicId, id, core.data, attrs.data);
    if (result === "not_found") return fail("That patient couldn't be found.");
    if (result === "phone_taken") {
      return fail("Another patient already uses that phone number.", {
        phone: "Already used by another patient.",
      });
    }
  } catch (error) {
    console.error("[clinic-data] savePatient failed", error);
    return fail(GENERIC);
  }
  revalidatePath("/patients");
  revalidatePath(`/patients/${id}`);
  return { ok: true };
}

const customInputSchema = z.object({
  isActive: z.boolean(),
  attributes: z.unknown(),
});

export async function saveRecord(
  entityType: string,
  id: string | null,
  input: z.input<typeof customInputSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY_DATA;
  const shape = customInputSchema.safeParse(input);
  if (!shape.success || typeof entityType !== "string") return fail(GENERIC);
  if (isSystemEntityType(entityType)) return fail("That page couldn't be found.");

  let savedId: string;
  try {
    const def = await activeDefinition(user, entityType);
    if (!def || def.kind !== "custom") return fail("That page couldn't be found.");
    const existing = id ? await getRecord(user.clinicId, entityType, id) : null;
    if (id && !existing) return fail(`That ${def.singularLabel.toLowerCase()} couldn't be found.`);
    const attrs = validateAttributes(def.fields, shape.data.attributes, existing?.attributes);
    if (!attrs.ok) {
      return fail("Check the highlighted fields.", prefixErrors("attributes", attrs.fieldErrors));
    }
    if (id) {
      const found = await updateRecord(
        user.clinicId,
        entityType,
        id,
        user.id,
        shape.data.isActive,
        attrs.data,
      );
      if (!found) return fail(`That ${def.singularLabel.toLowerCase()} couldn't be found.`);
      savedId = id;
    } else {
      savedId = await createRecord(
        user.clinicId,
        entityType,
        user.id,
        shape.data.isActive,
        attrs.data,
      );
    }
  } catch (error) {
    console.error("[clinic-data] saveRecord failed", error);
    return fail(GENERIC);
  }
  revalidatePath(`/data/${entityType}`);
  revalidatePath(`/data/${entityType}/${savedId}`);
  return { ok: true, data: { id: savedId } };
}

export async function setRecordActiveFlag(
  entityType: string,
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const user = await requireUser();
  if (!user) return SESSION_EXPIRED;
  if (user.role !== "admin") return ADMIN_ONLY_DATA;
  if (typeof entityType !== "string" || typeof id !== "string" || typeof isActive !== "boolean") {
    return fail(GENERIC);
  }
  try {
    const def = await activeDefinition(user, entityType);
    if (!def || def.kind !== "custom") return fail("That page couldn't be found.");
    const found = await setRecordActive(user.clinicId, entityType, id, user.id, isActive);
    if (!found) return fail("That row couldn't be found.");
  } catch (error) {
    console.error("[clinic-data] setRecordActiveFlag failed", error);
    return fail(GENERIC);
  }
  revalidatePath(`/data/${entityType}`);
  revalidatePath(`/data/${entityType}/${id}`);
  return { ok: true };
}
