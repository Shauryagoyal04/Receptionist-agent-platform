# Clinic data contract: configurable pages the agent reads

**Audience:** engineers on both repos. The console (`receptionist-agent-platform`) **writes** clinic data through admin pages; the agent (`clinic-ai-agent`) **reads** it to answer patients. Both use the same MongoDB (the agent's Atlas cluster, database `clinic-ai-agent`). Companion to [`agent-data-contract.md`](agent-data-contract.md), which covers the opposite direction (the agent writes `conversations`, the console reads them).

**Why this exists.** Every clinic describes itself differently: one wants a doctor's degrees and languages, another wants consultation fees and room numbers, a third wants a page of pathology tests the first two don't have. Instead of a fixed schema, each clinic **defines its own pages and fields**, and both apps work from those definitions.

---

## 1. The model in one picture

```
entity_definitions   ← "what pages and fields does this clinic have?"   (console writes, agent reads)
   │ describes
   ├─ clinic        system page: one doc,   core fields + attributes{}
   ├─ doctors       system page: many docs, core fields + attributes{}
   ├─ patients      system page: many docs, core fields + attributes{}
   └─ records       custom pages (lab tests, services, packages, …): attributes{} only
```

- **Core fields** are fixed. The agent's booking logic depends on them, so they are never configurable.
- **`attributes`** holds every clinic-defined field, keyed by the field's `key`.
- Every document carries **`clinicId`** (string, e.g. `"main-clinic"`). Every read and write filters on it. The console takes it from the signed-in user's session, never from the request; the agent takes it from its `CLINIC_ID` setting.

---

## 2. `entity_definitions`

One document per `(clinicId, entityType)`. Unique index on both.

```js
{
  clinicId: "main-clinic",
  entityType: "lab_test",          // slug; see §2.1
  kind: "custom",                  // "system" for clinic | doctor | patient, else "custom"
  label: "Lab tests",              // plural, shown in navigation
  singularLabel: "Lab test",
  description: "Pathology tests we run in-house, with price and report turnaround.",
                                   // shown to staff AND given to the agent to explain the page
  agentEnabled: true,              // custom only: may the agent search this page? (system pages: ignored)
  titleField: "name",              // custom only: key of a required text field used as each row's title
  fields: [ /* §2.2 */ ],
  version: 4,                      // +1 on every change
  createdAt: "2026-11-17T10:00:00.000Z",   // ISO 8601 UTC strings, as in conversations
  updatedAt: "2026-11-17T10:00:00.000Z",
  updatedBy: "<user id>"
}
```

### 2.1 `entityType`

- Matches `^[a-z][a-z0-9_]{1,39}$`.
- `clinic`, `doctor` and `patient` are **system** types (`kind: "system"`). Their definition only adds fields under `attributes`, and you can't delete them. If a clinic has no definition for a system type yet, treat it as `fields: []`.
- Every other slug is a **custom** type, stored in `records`.
- **Immutable** once created. You can rename the label freely, never the slug.
- Deleting a custom type: set `archived: true` on the definition. Its records stay in the database but are hidden in the console and invisible to the agent.

### 2.2 Fields

```js
{
  key: "fastingRequired",     // ^[a-z][a-zA-Z0-9]{0,39}$  (camelCase). IMMUTABLE.
  label: "Fasting required",
  type: "boolean",            // §2.3. IMMUTABLE.
  required: false,
  options: [],                // select / multiselect only; non-empty there
  description: "Whether the patient must fast before sample collection.",  // optional
  agentVisible: true,         // may the agent read and say this value?
  filterable: false,          // console shows a filter for it on the list page
  pii: false,                 // personal data: never sent to the agent, even if agentVisible
  archived: false,            // "deleted": hidden everywhere, data kept
  order: 3                    // display order, ascending
}
```

Rules:

- `key` and `type` **never change**. To "change a type", archive the field and add a new one. This keeps existing values readable, and keeps what the agent has already said consistent with the data.
- Fields are **never removed** from the array; they are archived. Keys stay unique within a definition, including archived ones.
- Removing an `option` is allowed. Existing records keep the old value and display it as-is.
- At most **50** fields per definition.
- The agent sees a field only if `agentVisible && !pii && !archived`.

### 2.3 Field types and how values are stored

| `type` | Stored in `attributes` as | Console input |
|---|---|---|
| `text` | string (≤ 500 chars) | single-line input |
| `longtext` | string (≤ 5000 chars) | textarea |
| `number` | number (int or float), never a string | number input |
| `boolean` | `true` / `false` | switch |
| `date` | `"YYYY-MM-DD"` string | date picker |
| `select` | string, one of `options` | dropdown |
| `multiselect` | string[], each one of `options` | multi-select |
| `tags` | string[] (free text) | tag input |
| `email` | string | email input |
| `phone` | string as typed | tel input |
| `url` | string (`http(s)://`) | url input |

Omit the key, or use `null`, when a non-required field has no value. **Numbers must be stored as numbers**: the agent filters and compares them, and `"12"` doesn't compare as 12.

---

## 3. System pages: core fields

The agent depends on these exact names. Don't rename them. Clinic-defined fields go in `attributes`.

### `clinic` (one document per clinic)

| Field | Type | Notes |
|---|---|---|
| `clinicId` | string | unique |
| `clinicName` | string | required |
| `timings` | string | e.g. `"Mon-Sat, 9:00 AM - 5:00 PM"`, read out to patients |
| `address` | string | |
| `phone` | string | reception number |
| `attributes` | object | §2.3 |

### `doctors`

| Field | Type | Notes |
|---|---|---|
| `clinicId` | string | |
| `name` | string | required, **without** the "Dr." prefix (the agent adds it and matches on the bare name) |
| `specialization` | string | e.g. "General Physician" |
| `calendarEmail` | string \| null | the doctor's Google Calendar (its owner's email). The agent adds, moves and removes this doctor's appointments there. The doctor must share that calendar with the clinic's service account ("Make changes to events"). Blank/null = no calendar sync. |
| `isActive` | boolean | only active doctors are offered to patients |
| `availableDays` | string[] | full English weekday names: `"Monday"` … `"Sunday"` |
| `workingHours` | `{ start: "HH:mm", end: "HH:mm" }` | 24h; slots are generated from `start` up to `end` |
| `consultationDuration` | number | minutes per slot, e.g. 30 |
| `attributes` | object | e.g. degrees, experience, languages, fee |
| `createdAt` / `updatedAt` | ISO string or BSON date | the agent writes BSON dates; readers must accept both |

### `patients`

| Field | Type | Notes |
|---|---|---|
| `clinicId` | string | unique together with `phone` |
| `phone` | string | digits with country code, no `+` (WhatsApp `from` format), e.g. `919876543210` |
| `name`, `age`, `gender` | string, number, `"Male"`/`"Female"`/`"Other"` | the agent writes these when it books |
| `attributes` | object | staff-entered extras (e.g. blood group, allergies) |
| `createdAt` / `updatedAt` | ISO string or BSON date | the agent writes BSON dates; readers must accept both |

The agent creates and updates patients **only through the core fields** and never reads or writes `patients.attributes`. Patient extras are staff-only for now: a patient's medical notes shouldn't reach the model.

### `records` (custom pages)

```js
{
  clinicId: "main-clinic",
  entityType: "lab_test",
  isActive: true,                 // inactive rows: hidden from the agent, shown greyed in the console
  attributes: { name: "CBC", price: 350, fastingRequired: false, reportTime: "Same day" },
  createdAt: "…", updatedAt: "…", updatedBy: "<user id>"
}
```

The value at `attributes[titleField]` is the row's title, used both in the console list and by the agent.

### `appointments`

These stay agent-owned and aren't configurable. They now also carry `clinicId`, plus two read-only status objects the agent keeps up to date, which the console may show:

| Field | Shape |
|---|---|
| `calendarSync` | `{ status: "synced" \| "removed" \| "skipped" \| "error", calendarId?, eventId?, reason?, error?, at? }`: whether the booking is on the doctor's Google Calendar |
| `confirmation` | `{ status: "sent" \| "error", event: "booked" \| "rescheduled" \| "cancelled", via?: "template" \| "text", messageId?, error?, at? }`: the last WhatsApp confirmation sent to the patient |

Both are written by the agent's `outbox` worker (collection `outbox`, agent-internal).

---

## 4. Indexes

The agent creates these on startup (`scripts/seed.py`, and `ensure_indexes()` on boot). The console doesn't need to.

```js
db.entity_definitions.createIndex({ clinicId: 1, entityType: 1 }, { unique: true });
db.records.createIndex({ clinicId: 1, entityType: 1, isActive: 1 });
db.doctors.createIndex({ clinicId: 1, isActive: 1, name: 1 });
db.patients.createIndex({ clinicId: 1, phone: 1 }, { unique: true });   // replaces the old unique { phone }
db.clinic.createIndex({ clinicId: 1 }, { unique: true });
```

---

## 5. Who may do what

| Action | Console role |
|---|---|
| Create / edit / archive definitions and fields (`/settings/data`) | `admin` |
| Create / edit / deactivate doctors, patients, custom records; edit clinic info | `admin` and `staff` |
| Read everything | `admin` and `staff` |

The console validates every write against the definition (zod schema built from `fields`) before saving. The agent never writes definitions or custom records.

---

## 6. What the agent does with it

- **Freshness:** it re-reads definitions at most every **60 seconds**, so an edit in the console reaches patients within a minute without a redeploy.
- **Prompt:** it adds a "what this clinic offers" section to its system prompt, listing each `agentEnabled` custom page with its `label` and `description`.
- **Tools:**
  - `list_doctors` and `get_clinic_info` include agent-visible `attributes`. Field labels are used as the keys, so the model reads "Experience (years): 12".
  - `search_catalog(catalog, query)` searches an `agentEnabled` custom page by text across its agent-visible fields and returns at most 10 active rows.
- **Lenient reading:** a record whose values don't match the definition (wrong type, unknown option) is skipped for that field and logged, never shown half-broken and never allowed to fail the patient's turn.

### 6.1 Staff page: human handoff alerts

One custom page has a fixed meaning to the agent: `entityType: "staff"`. When a patient asks to talk to a person, the agent WhatsApps every **active** staff row whose attributes have:

| Key | Type | Meaning |
|---|---|---|
| `name` | `text` | used in the greeting ("Hi Anita") |
| `phone` | `phone` | WhatsApp number with country code (a bare 10-digit number is read as Indian) |
| `receivesEscalations` | `boolean` | `true` = send this person handoff alerts |

The agent reads these keys directly, not through `agentVisible`, so keep `phone` marked `pii` and the page `agentEnabled: false`; patients never see staff numbers. Don't rename these keys; other fields on the page are free. Archiving the definition turns alerts off.

---

## 7. What breaks if this contract is broken

| Broken rule | Consequence |
|---|---|
| Missing `clinicId` | The document is invisible to everyone. The agent can't offer a doctor that has none. |
| Doctor `name` with "Dr." prefix | Booking by name may fail ("Dr. Dr. Asha"). |
| `availableDays` / `workingHours` malformed | That doctor shows no free slots. |
| Number stored as string | Comparisons and sorting are wrong; the agent may misquote prices. |
| Renamed `key` | Every existing value for that field silently disappears. |
| `pii` field marked `agentVisible` | Still withheld from the agent (`pii` wins), by design. |
