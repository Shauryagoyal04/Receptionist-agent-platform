import "server-only";

import { ObjectId, type Collection, type Document, type Filter } from "mongodb";

import { COLLECTIONS, getDb } from "@/lib/mongodb";
import {
  GENDERS,
  WEEKDAYS,
  type Attributes,
  type AttributesWrite,
  type ClinicCore,
  type DoctorCore,
  type FieldDef,
  type Gender,
  type PatientCore,
  type Weekday,
} from "@/lib/clinic-data/model";
import { isDuplicateKey } from "@/lib/data/definitions";
import { nullableIsoDate } from "@/lib/types";

/*
 * The documents the clinic's pages describe (contract §3): the clinic itself,
 * doctors, patients, and custom-page rows in `records`.
 *
 * - Every query filters on the clinicId the caller passes (from the session).
 * - Reads are lenient: the agent writes doctors/patients/clinic too, often
 *   without `attributes` and with BSON dates, so missing or odd values
 *   degrade instead of failing the page.
 * - Writes `$set` individual core fields and `attributes.<key>` paths, so
 *   anything the console doesn't manage (archived fields, agent-owned extras
 *   like the clinic's `slotDuration`) is preserved.
 */

export const RECORDS_COLLECTION = "records";

async function col(name: string): Promise<Collection<Document>> {
  return (await getDb()).collection(name);
}

function toObjectId(id: string): ObjectId | null {
  return ObjectId.isValid(id) && /^[0-9a-f]{24}$/i.test(id) ? new ObjectId(id) : null;
}

function readAttributes(value: unknown): Attributes {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Attributes)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

const iso = (value: unknown): string | null =>
  nullableIsoDate.safeParse(value).data ?? null;

/** `$set` / `$unset` fragments for an attributes write. */
function attributeUpdate(write: AttributesWrite): { set: Document; unset: Document } {
  const set: Document = {};
  const unset: Document = {};
  for (const [key, value] of Object.entries(write.set)) set[`attributes.${key}`] = value;
  for (const key of write.unset) unset[`attributes.${key}`] = "";
  return { set, unset };
}

/**
 * An agent-written doc may have no `attributes` at all, which is fine: `$set`
 * on a dotted path creates it. But `attributes: null` (or any non-object)
 * would make that `$set` fail, so normalize that case first.
 */
async function ensureAttributesObject(
  collection: Collection<Document>,
  filter: Filter<Document>,
): Promise<void> {
  await collection.updateOne(
    { ...filter, attributes: { $exists: true, $not: { $type: "object" } } },
    { $set: { attributes: {} } },
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* ------------------------------------------------------------------ */
/* Attribute filters (list pages)                                      */
/* ------------------------------------------------------------------ */

/** `{ key: rawValue }` from the URL, applied to filterable fields only. */
export type AttributeFilters = Record<string, string>;

export function buildAttributeFilter(
  fields: FieldDef[],
  filters: AttributeFilters,
): Filter<Document> {
  const query: Filter<Document> = {};
  for (const field of fields) {
    if (!field.filterable || field.archived) continue;
    const raw = filters[field.key]?.trim();
    if (!raw) continue;
    const path = `attributes.${field.key}`;
    switch (field.type) {
      case "boolean":
        if (raw === "true" || raw === "false") query[path] = raw === "true";
        break;
      case "number": {
        const n = Number(raw);
        if (Number.isFinite(n)) query[path] = n;
        break;
      }
      case "select":
      case "multiselect":
      case "date":
        // Equality also matches an element of an array (multiselect).
        query[path] = raw;
        break;
      case "tags":
        query[path] = new RegExp(`^${escapeRegex(raw)}$`, "i");
        break;
      default:
        query[path] = new RegExp(escapeRegex(raw), "i");
    }
  }
  return query;
}

/* ------------------------------------------------------------------ */
/* Clinic                                                              */
/* ------------------------------------------------------------------ */

export type ClinicRecord = {
  clinicName: string;
  timings: string | null;
  address: string | null;
  phone: string | null;
  attributes: Attributes;
  updatedAt: string | null;
  exists: boolean;
};

export async function getClinicRecord(clinicId: string): Promise<ClinicRecord> {
  const doc = await (await col(COLLECTIONS.clinic)).findOne({ clinicId });
  if (!doc) {
    return {
      clinicName: "",
      timings: null,
      address: null,
      phone: null,
      attributes: {},
      updatedAt: null,
      exists: false,
    };
  }
  return {
    clinicName: readString(doc.clinicName) ?? "",
    timings: readString(doc.timings),
    address: readString(doc.address),
    phone: readString(doc.phone),
    attributes: readAttributes(doc.attributes),
    updatedAt: iso(doc.updatedAt),
    exists: true,
  };
}

export async function saveClinicRecord(
  clinicId: string,
  core: ClinicCore,
  attributes: AttributesWrite,
): Promise<void> {
  const collection = await col(COLLECTIONS.clinic);
  const now = new Date().toISOString();
  const attr = attributeUpdate(attributes);

  const set: Document = { clinicName: core.clinicName, updatedAt: now, ...attr.set };
  const unset: Document = { ...attr.unset };
  for (const key of ["timings", "address", "phone"] as const) {
    if (core[key] === null) unset[key] = "";
    else set[key] = core[key];
  }

  const existing = await collection.findOne({ clinicId }, { projection: { _id: 1 } });
  if (!existing) {
    // Insert rather than upsert: an upsert mixing `$unset attributes.x` with
    // an inserted `attributes` object is a path conflict.
    const doc: Document = { clinicId, attributes: { ...attributes.set }, createdAt: now };
    for (const [key, value] of Object.entries(set)) {
      if (!key.startsWith("attributes.")) doc[key] = value;
    }
    try {
      await collection.insertOne(doc);
      return;
    } catch (error) {
      // Someone created it in between; fall through to a normal update.
      if (!isDuplicateKey(error)) throw error;
    }
  }

  await ensureAttributesObject(collection, { clinicId });
  const update: Document = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;
  await collection.updateOne({ clinicId }, update);
}

/* ------------------------------------------------------------------ */
/* Doctors                                                             */
/* ------------------------------------------------------------------ */

export type DoctorRecord = {
  id: string;
  name: string;
  specialization: string;
  calendarEmail: string;
  isActive: boolean;
  availableDays: Weekday[];
  workingHours: { start: string; end: string };
  consultationDuration: number | null;
  attributes: Attributes;
  createdAt: string | null;
  updatedAt: string | null;
};

function toDoctor(doc: Document): DoctorRecord {
  const hours =
    doc.workingHours && typeof doc.workingHours === "object" ? doc.workingHours : {};
  return {
    id: String(doc._id),
    name: readString(doc.name) ?? "",
    specialization: readString(doc.specialization) ?? "",
    calendarEmail: readString(doc.calendarEmail) ?? "",
    isActive: doc.isActive === true,
    availableDays: Array.isArray(doc.availableDays)
      ? (WEEKDAYS.filter((day) => doc.availableDays.includes(day)) as Weekday[])
      : [],
    workingHours: {
      start: readString(hours.start) ?? "",
      end: readString(hours.end) ?? "",
    },
    consultationDuration:
      typeof doc.consultationDuration === "number" ? doc.consultationDuration : null,
    attributes: readAttributes(doc.attributes),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export async function listDoctors(
  clinicId: string,
  options: { q?: string | null; fields?: FieldDef[]; filters?: AttributeFilters } = {},
): Promise<DoctorRecord[]> {
  const query: Filter<Document> = {
    clinicId,
    ...buildAttributeFilter(options.fields ?? [], options.filters ?? {}),
  };
  const term = options.q?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegex(term), "i");
    query.$or = [{ name: pattern }, { specialization: pattern }];
  }
  const docs = await (await col(COLLECTIONS.doctors))
    .find(query)
    .sort({ isActive: -1, name: 1 })
    .limit(500)
    .toArray();
  return docs.map(toDoctor);
}

export async function getDoctor(clinicId: string, id: string): Promise<DoctorRecord | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await (await col(COLLECTIONS.doctors)).findOne({ _id, clinicId });
  return doc ? toDoctor(doc) : null;
}

function doctorCoreDoc(core: DoctorCore): Document {
  return {
    name: core.name,
    specialization: core.specialization,
    calendarEmail: core.calendarEmail || null,
    isActive: core.isActive,
    availableDays: core.availableDays,
    workingHours: { start: core.workingHours.start, end: core.workingHours.end },
    consultationDuration: core.consultationDuration,
  };
}

export async function createDoctor(
  clinicId: string,
  core: DoctorCore,
  attributes: AttributesWrite,
): Promise<string> {
  const now = new Date().toISOString();
  const result = await (await col(COLLECTIONS.doctors)).insertOne({
    clinicId,
    ...doctorCoreDoc(core),
    attributes: { ...attributes.set },
    createdAt: now,
    updatedAt: now,
  });
  return String(result.insertedId);
}

export async function updateDoctor(
  clinicId: string,
  id: string,
  core: DoctorCore,
  attributes: AttributesWrite,
): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  const collection = await col(COLLECTIONS.doctors);
  const filter = { _id, clinicId };
  await ensureAttributesObject(collection, filter);
  const attr = attributeUpdate(attributes);
  const update: Document = {
    $set: { ...doctorCoreDoc(core), ...attr.set, updatedAt: new Date().toISOString() },
  };
  if (Object.keys(attr.unset).length > 0) update.$unset = attr.unset;
  const result = await collection.updateOne(filter, update);
  return result.matchedCount > 0;
}

export async function setDoctorActive(
  clinicId: string,
  id: string,
  isActive: boolean,
): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  const result = await (await col(COLLECTIONS.doctors)).updateOne(
    { _id, clinicId },
    { $set: { isActive, updatedAt: new Date().toISOString() } },
  );
  return result.matchedCount > 0;
}

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export type PatientRecord = {
  id: string;
  phone: string;
  name: string;
  age: number | null;
  gender: Gender | null;
  attributes: Attributes;
  createdAt: string | null;
  updatedAt: string | null;
};

function toPatient(doc: Document): PatientRecord {
  return {
    id: String(doc._id),
    phone: readString(doc.phone) ?? "",
    name: readString(doc.name) ?? "",
    age: typeof doc.age === "number" ? doc.age : null,
    gender: (GENDERS as readonly string[]).includes(doc.gender)
      ? (doc.gender as Gender)
      : null,
    attributes: readAttributes(doc.attributes),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export const PATIENT_PAGE_SIZE = 50;

export async function listPatients(
  clinicId: string,
  options: { q?: string | null; page?: number } = {},
): Promise<{ patients: PatientRecord[]; total: number; page: number; pageCount: number }> {
  const query: Filter<Document> = { clinicId };
  const term = options.q?.trim();
  if (term) {
    const pattern = new RegExp(escapeRegex(term), "i");
    const digits = term.replace(/\D/g, "");
    query.$or = [{ name: pattern }];
    if (digits) query.$or.push({ phone: new RegExp(escapeRegex(digits)) });
  }
  const collection = await col(COLLECTIONS.patients);
  const total = await collection.countDocuments(query);
  const pageCount = Math.max(1, Math.ceil(total / PATIENT_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page ?? 1), pageCount);
  const docs = await collection
    .find(query)
    .sort({ name: 1, _id: 1 })
    .skip((page - 1) * PATIENT_PAGE_SIZE)
    .limit(PATIENT_PAGE_SIZE)
    .toArray();
  return { patients: docs.map(toPatient), total, page, pageCount };
}

export async function getPatient(clinicId: string, id: string): Promise<PatientRecord | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await (await col(COLLECTIONS.patients)).findOne({ _id, clinicId });
  return doc ? toPatient(doc) : null;
}

export type PatientUpdateResult = "ok" | "not_found" | "phone_taken";

/**
 * Updates a patient's core fields and staff-only attributes.
 *
 * A phone already used by another patient of this clinic is refused up front;
 * the duplicate-key catch covers the race and the database's unique index
 * (which, until the agent migrates it, is still global on `phone`).
 */
export async function updatePatient(
  clinicId: string,
  id: string,
  core: PatientCore,
  attributes: AttributesWrite,
): Promise<PatientUpdateResult> {
  const _id = toObjectId(id);
  if (!_id) return "not_found";
  const collection = await col(COLLECTIONS.patients);

  const clash = await collection.findOne(
    { clinicId, phone: core.phone, _id: { $ne: _id } },
    { projection: { _id: 1 } },
  );
  if (clash) return "phone_taken";

  const filter = { _id, clinicId };
  await ensureAttributesObject(collection, filter);
  const attr = attributeUpdate(attributes);
  const set: Document = {
    phone: core.phone,
    name: core.name,
    ...attr.set,
    updatedAt: new Date().toISOString(),
  };
  const unset: Document = { ...attr.unset };
  if (core.age === null) unset.age = "";
  else set.age = core.age;
  if (core.gender === null) unset.gender = "";
  else set.gender = core.gender;

  const update: Document = { $set: set };
  if (Object.keys(unset).length > 0) update.$unset = unset;
  try {
    const result = await collection.updateOne(filter, update);
    return result.matchedCount > 0 ? "ok" : "not_found";
  } catch (error) {
    if (isDuplicateKey(error)) return "phone_taken";
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/* Custom-page records                                                 */
/* ------------------------------------------------------------------ */

export type CustomRecord = {
  id: string;
  entityType: string;
  isActive: boolean;
  attributes: Attributes;
  createdAt: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

function toCustomRecord(doc: Document): CustomRecord {
  return {
    id: String(doc._id),
    entityType: String(doc.entityType),
    // Missing reads as active, matching how a reader would treat a row
    // inserted by hand without the flag.
    isActive: doc.isActive !== false,
    attributes: readAttributes(doc.attributes),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
    updatedBy: readString(doc.updatedBy),
  };
}

export async function listRecords(
  clinicId: string,
  entityType: string,
  options: {
    q?: string | null;
    titleField?: string | null;
    fields?: FieldDef[];
    filters?: AttributeFilters;
    includeInactive?: boolean;
  } = {},
): Promise<CustomRecord[]> {
  const query: Filter<Document> = {
    clinicId,
    entityType,
    ...buildAttributeFilter(options.fields ?? [], options.filters ?? {}),
  };
  if (options.includeInactive === false) query.isActive = true;
  const term = options.q?.trim();
  if (term && options.titleField) {
    query[`attributes.${options.titleField}`] = new RegExp(escapeRegex(term), "i");
  }
  const sort: Document = { isActive: -1 };
  if (options.titleField) sort[`attributes.${options.titleField}`] = 1;
  sort._id = 1;
  const docs = await (await col(RECORDS_COLLECTION))
    .find(query)
    .sort(sort)
    .limit(500)
    .toArray();
  return docs.map(toCustomRecord);
}

export async function getRecord(
  clinicId: string,
  entityType: string,
  id: string,
): Promise<CustomRecord | null> {
  const _id = toObjectId(id);
  if (!_id) return null;
  const doc = await (await col(RECORDS_COLLECTION)).findOne({ _id, clinicId, entityType });
  return doc ? toCustomRecord(doc) : null;
}

export async function createRecord(
  clinicId: string,
  entityType: string,
  userId: string,
  isActive: boolean,
  attributes: AttributesWrite,
): Promise<string> {
  const now = new Date().toISOString();
  const result = await (await col(RECORDS_COLLECTION)).insertOne({
    clinicId,
    entityType,
    isActive,
    attributes: { ...attributes.set },
    createdAt: now,
    updatedAt: now,
    updatedBy: userId,
  });
  return String(result.insertedId);
}

export async function updateRecord(
  clinicId: string,
  entityType: string,
  id: string,
  userId: string,
  isActive: boolean,
  attributes: AttributesWrite,
): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  const collection = await col(RECORDS_COLLECTION);
  const filter = { _id, clinicId, entityType };
  await ensureAttributesObject(collection, filter);
  const attr = attributeUpdate(attributes);
  const update: Document = {
    $set: { isActive, ...attr.set, updatedAt: new Date().toISOString(), updatedBy: userId },
  };
  if (Object.keys(attr.unset).length > 0) update.$unset = attr.unset;
  const result = await collection.updateOne(filter, update);
  return result.matchedCount > 0;
}

export async function setRecordActive(
  clinicId: string,
  entityType: string,
  id: string,
  userId: string,
  isActive: boolean,
): Promise<boolean> {
  const _id = toObjectId(id);
  if (!_id) return false;
  const result = await (await col(RECORDS_COLLECTION)).updateOne(
    { _id, clinicId, entityType },
    { $set: { isActive, updatedAt: new Date().toISOString(), updatedBy: userId } },
  );
  return result.matchedCount > 0;
}
