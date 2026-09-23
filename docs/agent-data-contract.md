# Data contract: what the console needs the agent to store

**Audience:** the engineer working on [`reizn7/clinic-ai-agent`](https://github.com/reizn7/clinic-ai-agent) (Python v2, Google ADK + Gemini + MongoDB).

> **Build order:** this document is the *shape*. [`agent-roadmap.md`](agent-roadmap.md) is the *order*, with effort estimates and the reasoning behind each priority. Start there.

**Why this exists.** The staff console reads the same MongoDB the agent writes. Today the agent stores transcripts as one append-only document per phone number:

```js
// transcripts
{ phone: "919…", messages: [ { role: "user"|"assistant", content: "…" } ] }
```

There are **no timestamps anywhere in that document**, and no boundary between one patient's Tuesday booking call and their Friday cancellation. Everything the console does — the conversation list, date filtering, every chart, escalation triage — is built on "which conversation, when". So this is not a wishlist: without the Must-have block below, the console has no time axis and most of it cannot exist.

Nothing here asks the agent to change how it talks to patients. It is all record-keeping alongside the existing flow.

---

## 1. What to write

Write one document per **conversation** (not per phone) into a new `conversations` collection in the same database. That name does not collide with the agent's existing `transcripts`, `appointments`, `patients`, `doctors`, `clinic`.

Keep writing `transcripts` exactly as now — the agent needs it to seed prompt history, and the console does not read it. This is an addition, not a migration.

### Delivery: either is fine

- **Write straight to Mongo** (simplest — the agent already holds a `MongoClient`).
- **Or `POST /api/ingest/conversation`** on the console with a bearer token, if you'd rather not share write access. Same document shape either way; the console computes derived fields itself and is idempotent on `externalId`.

---

## 2. Sessionising: where one conversation ends

A conversation is a contiguous run of turns with the same patient. Recommended rule, in order of preference:

1. **Idle timeout.** On each inbound turn, if the last message for that phone is older than **30 minutes**, start a new conversation document. Otherwise append to the open one.
2. Also close the conversation when `escalate_to_human` fires, or when a booking completes and the patient says nothing for the timeout.

A conversation that is still inside its idle window is `status: "active"` — write it as you go rather than holding it in memory, so a crash does not lose the turns.

---

## 3. Fields

### 3.1 Must have — the console cannot function without these

| Field | Type | Notes |
|---|---|---|
| `externalId` | string | Your stable id for this conversation. The console upserts on it, so re-sending is safe. |
| `phone` | string | E.164, e.g. `+919876543210`. |
| `patientName` | string | From the `patients` record; `"Unknown"` is acceptable. |
| `startedAt` | ISO 8601 UTC | First message of the conversation. `datetime.now(timezone.utc).isoformat()`. |
| `endedAt` | ISO 8601 UTC \| null | Last message. `null` while still active. |
| `status` | `"active"` \| `"completed"` \| `"escalated"` \| `"abandoned"` | `abandoned` = timed out mid-flow with nothing resolved. |
| `messages[]` | array | Ordered oldest → newest. |
| `messages[].role` | `"patient"` \| `"agent"` \| `"system"` | Rename of your current `user`/`assistant`. |
| `messages[].content` | string | |
| `messages[].timestamp` | ISO 8601 UTC | **The single most important missing field.** Stamp it in `append_turn`. |

> Cost to implement: one `datetime.now(timezone.utc)` per message plus the idle-timeout check. Everything below is genuinely incremental.

### 3.2 Should have — this is where the console earns its keep

| Field | Type | How to produce it |
|---|---|---|
| `outcome` | see enum below | **Derive from which tools succeeded** — no LLM call needed. See §4. |
| `escalated` | boolean | True when `escalate_to_human` fired. |
| `escalationReason` | string \| null | `escalate_to_human` already receives `reason` — it currently only `log.info`s it. Persist that string. |
| `primaryIntent` | see enum below | Derive from the first tool called, or classify once at session end. |
| `intents[]` | array of the same enum | All intents seen in the conversation. |
| `doctorName` | string \| null | From `book_appointment` / `check_availability` args. |
| `appointmentAt` | ISO 8601 UTC \| null | Combine the appointment `date` + `slot` you already store. |
| `messages[].type` | `"text"` \| `"tool_call"` \| `"handoff"` \| `"system_event"` | Defaults to `"text"`. |
| `messages[].tool` | object \| null | Present when `type === "tool_call"`. Shape below. |

**Tool call shape** — ADK already emits `function_call` / `function_response` events in the `Runner.run_async` loop you iterate in `runtime/turn.py`. Capture them there:

```json
{
  "name": "check_availability",
  "args": { "doctor_name": "Dr. Anjali Mehta", "date": "2026-10-14" },
  "result": { "slots": ["10:00", "10:30"] },
  "status": "success",
  "error": null,
  "durationMs": 684
}
```

On failure: `status: "error"`, `result: null`, `error` set to the message. **Please do record failures** — a tool that silently failed is the most useful thing on the whole console when a booking did not happen, and it is invisible if only successes are stored.

### 3.3 Nice to have — real value, but the console degrades gracefully

| Field | Type | How to produce it |
|---|---|---|
| `summary` | string | One or two sentences, written by the model at session end. |
| `sentiment` | `"positive"` \| `"neutral"` \| `"negative"` | One cheap classification call at session end, or a Gemini structured-output call alongside the summary. |
| `language` | `"en"` \| `"hi"` | Detect once; Hinglish counts as `hi`. |
| `messages[].latencyMs` | number \| null | Wall-clock time around the `Runner.run_async` call, on agent messages. |
| `messages[].confidence` | number 0–1 \| null | Only if the model exposes it. The console flags anything below 0.7. |
| `channel` | `"whatsapp"` \| `"voice"` \| `"web_chat"` | Constant `"whatsapp"` today. The console hides its channel UI until more than one channel is enabled, so sending it costs nothing and voice later needs no migration. |
| `tags[]` | array of string | Free-form, e.g. `"insurance"`, `"senior-citizen"`. |

---

## 4. Enums

These are closed sets. The console renders labels, colors and filters from them, so a value outside the set will be dropped rather than displayed.

**`outcome`** — derive it from tool results, which is free and more reliable than asking the model:

| Value | Derivation |
|---|---|
| `appointment_booked` | `book_appointment` returned success |
| `appointment_cancelled` | `cancel_appointment` returned success |
| `appointment_rescheduled` | a cancel followed by a book in the same conversation |
| `info_provided` | only `get_clinic_info` / `list_doctors` / `list_my_appointments` ran, and the patient did not ask for more |
| `escalated` | `escalate_to_human` fired |
| `no_resolution` | none of the above — the patient left mid-flow |

**`primaryIntent`**: `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `doctor_availability`, `clinic_info`, `consultation_fees`, `report_status`, `other`.

*(Your toolset has no fees or report-status tool yet. Leave those unused — the console already handles a zero count.)*

---

## 5. Worked example

```json
{
  "externalId": "conv_01J8X…",
  "phone": "+919876543210",
  "patientName": "Rahul Deshpande",
  "channel": "whatsapp",
  "status": "completed",
  "outcome": "appointment_booked",
  "primaryIntent": "book_appointment",
  "intents": ["book_appointment"],
  "doctorName": "Dr. Karan Grewal",
  "appointmentAt": "2026-10-14T06:00:00.000Z",
  "startedAt": "2026-09-23T09:12:05.000Z",
  "endedAt": "2026-09-23T09:13:50.000Z",
  "escalated": false,
  "escalationReason": null,
  "sentiment": "positive",
  "language": "en",
  "summary": "Rahul booked an ENT slot with Dr. Karan Grewal for 14 Oct. Confirmation sent.",
  "tags": [],
  "messages": [
    {
      "role": "patient",
      "type": "text",
      "content": "Hi, I need to see an ENT doctor this week.",
      "timestamp": "2026-09-23T09:12:05.000Z"
    },
    {
      "role": "agent",
      "type": "tool_call",
      "content": "check_availability(doctor_name, date)",
      "timestamp": "2026-09-23T09:12:08.000Z",
      "tool": {
        "name": "check_availability",
        "args": { "doctor_name": "Dr. Karan Grewal", "date": "2026-10-14" },
        "result": { "slots": ["11:30", "12:00"] },
        "status": "success",
        "error": null,
        "durationMs": 684
      }
    },
    {
      "role": "agent",
      "type": "text",
      "content": "Dr. Karan Grewal has 11:30am free on 14 Oct. Shall I book it?",
      "timestamp": "2026-09-23T09:12:12.000Z",
      "latencyMs": 940
    }
  ]
}
```

---

## 6. Indexes

If writing to Mongo directly, please create these — the console's list and charts depend on them:

```js
db.conversations.createIndex({ externalId: 1 }, { unique: true });
db.conversations.createIndex({ clinicId: 1, startedAt: -1 });
db.conversations.createIndex({ clinicId: 1, outcome: 1, startedAt: -1 });
db.conversations.createIndex({ clinicId: 1, escalated: 1, startedAt: -1 });
db.conversations.createIndex({ phone: 1, startedAt: -1 });
```

`clinicId` is a string the console stamps on every document so a second clinic is a later change rather than a migration. Use `"main-clinic"` unless told otherwise.

---

## 7. What breaks if a field is skipped

| Skipped | Consequence |
|---|---|
| `messages[].timestamp` | **Fatal.** No transcript ordering, no duration, no time axis — the console cannot be built. |
| `startedAt` / session boundaries | **Fatal.** No conversation list, no date filters, no charts. |
| `outcome` | The outcome column, the outcome chart and the booking KPI all go blank. |
| `escalated` / `escalationReason` | The **Awaiting follow-up** queue stays empty, so patients the agent promised a callback to are invisible to staff. This is the most actionable screen in the console. |
| tool call messages | Tool reliability disappears, and a reviewer cannot see *why* a booking failed. |
| `sentiment` | One chart and one column drop out. Everything else is fine. |
| `latencyMs` / `confidence` | Per-message performance detail is lost. Nothing else is affected. |

---

## 8. Suggested order of work

1. **Timestamps + sessionisation** (§3.1). Unblocks the entire console.
2. **Persist the escalation reason** — one line; `escalate_to_human` already has it.
3. **Outcome derivation from tool results** (§4). No model call, high value.
4. **Tool call capture** from the ADK event loop (§3.2).
5. **Summary, sentiment, language** in one structured-output call at session end.
6. **Latency and confidence** (§3.3).

Steps 1 and 2 alone make the console useful. Everything after is incremental.
