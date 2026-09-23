# Ingestion API

How the AI agent delivers finished conversations to the console.

- **What the agent needs to record in the first place** is specified in [agent-data-contract.md](agent-data-contract.md).
- This page is the wire format for delivering it over HTTP. The machine-checked version lives in [`lib/ingest/schema.ts`](../lib/ingest/schema.ts).

> The agent can also write straight to the `conversations` collection, since it shares the database. Use this endpoint when you'd rather not give the agent write access, or want the console to compute the derived fields for you.

## `POST /api/ingest/conversation`

### Authentication

A static bearer token, compared in constant time against `INGEST_API_KEY`:

```
Authorization: Bearer <INGEST_API_KEY>
```

A missing, malformed or wrong token returns `401` with no detail. If `INGEST_API_KEY` is unset the endpoint refuses everything rather than accepting everything.

### Rate limit

60 requests per minute per key. Beyond that: `429` with a `Retry-After` header.

The limiter is per server instance and resets on deploy — a backstop against a runaway retry loop, not a security control. Put a real limiter in front of the app if you need a global one.

### Idempotency

Conversations are upserted on `externalId`. Re-sending the same conversation updates it in place instead of creating a duplicate, so an agent that times out mid-POST can safely retry.

Staff annotations (`reviewedBy`, `reviewedAt`, `staffNote`) are only set on insert, so a re-delivery never wipes a reviewer's note.

### Fields the server computes

These are **rejected if sent** — they drive the analytics page, and trusting a caller for them means a bug in the agent silently skews every number:

`messageCount`, `patientMessageCount`, `agentMessageCount`, `durationSec`, `avgAgentLatencyMs`, `lastMessagePreview`, `toolStats`, `clinicId`

### Request body

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `externalId` | string | **yes** | Your stable id. Upsert key. |
| `phone` | string | **yes** | E.164, e.g. `+919876543210`. |
| `startedAt` | ISO 8601 | **yes** | |
| `outcome` | enum | **yes** | See below. |
| `primaryIntent` | enum | **yes** | See below. |
| `messages[]` | array | **yes** | Max 500. Each needs `role`, `content`, `timestamp`. |
| `patientName` | string | no | Defaults to `"Unknown"`. |
| `patientEmail` | string \| null | no | |
| `isReturning` | boolean | no | Defaults to `false`. |
| `channel` | `whatsapp` \| `voice` \| `web_chat` | no | Defaults to `whatsapp`. |
| `status` | `active` \| `completed` \| `escalated` \| `abandoned` | no | Defaults to `completed`. |
| `intents[]` | array of intent | no | `primaryIntent` is added automatically. |
| `doctorName` | string \| null | no | |
| `appointmentAt` | ISO 8601 \| null | no | |
| `endedAt` | ISO 8601 \| null | no | Falls back to the last message's timestamp. |
| `escalated` | boolean | no | Defaults to `false`. |
| `escalationReason` | string \| null | no | |
| `sentiment` | `positive` \| `neutral` \| `negative` | no | Defaults to `neutral`. |
| `language` | `en` \| `hi` | no | Defaults to `en`. |
| `summary` | string | no | 1–2 sentences. |
| `tags[]` | array of string | no | Max 20. |

**Message fields:** `role` (`patient` \| `agent` \| `system` \| `staff`), `type` (`text` \| `tool_call` \| `handoff` \| `system_event`, default `text`), `content`, `timestamp`, and optionally `audioUrl`, `latencyMs`, `confidence` (0–1), `tool`.

**Tool object** (required when `type` is `tool_call`): `name`, `args`, `result`, `status` (`success` \| `error`), `error`, `durationMs`.

**`outcome`:** `appointment_booked`, `appointment_cancelled`, `appointment_rescheduled`, `info_provided`, `escalated`, `no_resolution`

**`primaryIntent`:** `book_appointment`, `cancel_appointment`, `reschedule_appointment`, `doctor_availability`, `clinic_info`, `consultation_fees`, `report_status`, `other`

### Responses

| Status | Meaning |
| --- | --- |
| `201` | Created |
| `200` | Updated an existing `externalId` |
| `400` | Malformed JSON, or a body that failed validation. The response carries a Zod issue list with `path` and `message`. |
| `401` | Missing or wrong bearer token |
| `429` | Rate limited; see `Retry-After` |
| `500` | The write failed |

Success returns the stored id and the computed figures, so a caller can confirm the server agreed with its own count:

```json
{
  "id": "6ab414ed1a4ac6452197312e",
  "externalId": "conv_01J8X",
  "created": true,
  "messageCount": 3,
  "durationSec": 105
}
```

## Checking credentials

`GET` the same URL with the bearer token for a cheap liveness probe:

```bash
curl -s https://your-console.example.com/api/ingest/conversation \
  -H "Authorization: Bearer $INGEST_API_KEY"
# {"ok":true,"clinicId":"main-clinic"}
```

## Working example

```bash
curl -i -X POST http://localhost:3000/api/ingest/conversation \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "externalId": "conv_demo_0001",
    "phone": "+919876543210",
    "patientName": "Rahul Deshpande",
    "isReturning": true,
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
    "sentiment": "positive",
    "language": "en",
    "summary": "Rahul booked an ENT slot with Dr. Karan Grewal for 14 Oct.",
    "tags": ["new-patient"],
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
        "latencyMs": 940,
        "confidence": 0.94
      },
      {
        "role": "patient",
        "type": "text",
        "content": "Yes please.",
        "timestamp": "2026-09-23T09:13:40.000Z"
      },
      {
        "role": "agent",
        "type": "text",
        "content": "Booked. I have sent you a confirmation.",
        "timestamp": "2026-09-23T09:13:50.000Z",
        "latencyMs": 820,
        "confidence": 0.97
      }
    ]
  }'
```

The conversation appears at the top of `/conversations` immediately, and is included in `/analytics` for any range covering `startedAt`. Re-running the same command returns `200` instead of `201` and leaves a single row.

### A rejected body

```bash
curl -s -X POST http://localhost:3000/api/ingest/conversation \
  -H "Authorization: Bearer $INGEST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"externalId":"bad","phone":"+91987","startedAt":"2026-09-23T09:12:05.000Z","outcome":"nope","primaryIntent":"book_appointment","messages":[]}'
```

```json
{
  "error": "The conversation did not match the expected shape.",
  "issues": [{ "path": "outcome", "message": "Invalid option: expected one of \"appointment_booked\"|..." }]
}
```
