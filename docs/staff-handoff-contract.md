# Staff handoff contract

How a patient's request for a human reaches clinic staff, and how staff answer it,
between the agent (`clinic-ai-agent`, Python) and this console. Both apps share one
MongoDB database. This file is the source of truth for the fields below; change it
together with both repos.

There are no WhatsApp alerts to staff phones. Staff work the **Escalations** page.

## Flow

1. The patient asks for a person. The agent calls `escalate_to_human(reason)`, which
   inserts one `escalations` document (`status: "open"`).
2. **WhatsApp:** from that turn on the conversation is `handledBy: "staff"`. The AI
   stops replying. Patient messages keep landing in the conversation's `messages`.
   Staff reply from the conversation page. Each reply is an outbox job the agent
   sends.
3. **Voice:** the call has already ended. Staff see the caller's number on the
   Escalations page and phone them back.
4. Staff resolve the escalation. For WhatsApp that hands the chat back to the AI
   (`handledBy: "agent"`).

Dates are ISO 8601 UTC **strings** everywhere in this contract (the agent compares
`nextAttemptAt` as a string).

## `escalations` (agent inserts, console updates)

| Field | Type | Written by | Notes |
|---|---|---|---|
| `_id` | ObjectId | agent | |
| `clinicId` | string | agent | |
| `conversationId` | string \| null | agent | `conversations.externalId` |
| `channel` | `"whatsapp"` \| `"voice"` | agent | |
| `patientPhone` | string | agent | E.164, e.g. `+919811122233` |
| `patientName` | string | agent | `""` when unknown |
| `reason` | string | agent | ≤ 300 chars |
| `status` | `"open"` \| `"claimed"` \| `"resolved"` | both | agent inserts `open` |
| `createdAt`, `updatedAt` | ISO string | both | |
| `claimedBy`, `claimedByName`, `claimedAt` | string \| null | console | `claimedBy` = `users._id` as hex |
| `resolvedBy`, `resolvedByName`, `resolvedAt` | string \| null | console | |
| `resolutionNote` | string \| null | console | ≤ 2000 chars |

The agent creates at most one unresolved escalation per conversation: asking again
returns the existing one. Indexes (agent creates them): `{clinicId, status, createdAt}`
and `{clinicId, conversationId, status}`.

## `conversations` additions

| Field | Type | Written by | Notes |
|---|---|---|---|
| `handledBy` | `"agent"` \| `"staff"` | both | missing = `"agent"`. Agent sets `"staff"` on a WhatsApp escalation. Console sets `"agent"` on resolve. |
| `escalationId` | string | agent | hex `_id` of the latest escalation |
| `escalatedAt` | ISO string | agent | |
| `lastPatientMessageAt` | ISO string | agent | the 24-hour WhatsApp reply window is measured from this |

While `handledBy: "staff"` the agent never closes the conversation for being idle,
and never starts a new one for that phone.

### Staff messages (in `messages`)

```json
{
  "role": "staff",
  "type": "text",
  "content": "Hi Ravi, this is Priya from the clinic…",
  "timestamp": "2026-11-18T10:02:11.000Z",
  "clientId": "5b0c…",              // uuid, set by the console; the outbox job carries it
  "staff": { "userId": "65f…", "name": "Priya" },
  "delivery": { "status": "pending" }  // agent updates: "sent" | "failed"
}
```

`delivery` after the agent runs: `{status: "sent", waMessageId, at}` or
`{status: "failed", error, at}`.

Handing a chat back, the console appends
`{role: "system", type: "system_event", content: "Priya handed the chat back to the AI", timestamp}`.

## `outbox` job `staff.reply` (console inserts, agent sends)

```json
{
  "clinicId": "main-clinic",
  "kind": "staff.reply",
  "appointmentId": null,
  "status": "pending",
  "attempts": 0,
  "nextAttemptAt": "<now ISO>",
  "createdAt": "<now ISO>",
  "updatedAt": "<now ISO>",
  "conversationId": "conv_…",       // conversations.externalId
  "messageClientId": "5b0c…",       // the staff message's clientId
  "text": "Hi Ravi, …",             // ≤ 4096 chars (WhatsApp text limit)
  "staffUserId": "65f…",
  "staffName": "Priya"
}
```

The agent reads the phone number from the conversation, not from the job. A
WhatsApp 4xx (for example, the 24-hour window has closed) fails the job at once and
marks the message `delivery.status: "failed"`. Other errors retry with backoff;
the message is marked failed when retries run out.

**24-hour window.** WhatsApp only delivers free-text messages within 24 hours of the
patient's last message. The console disables the reply box outside that window.

## Roles (console)

- `staff`: Analytics, Conversations, Escalations. Nothing else, and every other
  page and Server Action refuses them.
- `admin`: everything.
