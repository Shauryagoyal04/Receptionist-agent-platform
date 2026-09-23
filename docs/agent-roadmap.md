# What to add to the agent, in priority order

**Audience:** the engineer working on [`reizn7/clinic-ai-agent`](https://github.com/reizn7/clinic-ai-agent) — Python 3.14, Google ADK single `LlmAgent`, Gemini, MongoDB, FastAPI.

**Companion documents:** [`agent-data-contract.md`](agent-data-contract.md) is the exact field-by-field shape the console reads. This page is the *order* to build it in, and why.

---

## The one thing worth reading first

`runtime/turn.py` iterates the full ADK event stream, and throws away almost all of it:

```python
def _final_text(event) -> str:
    content = getattr(event, "content", None)
    parts = getattr(content, "parts", None) if content else None
    if not parts:
        return ""
    return "".join(getattr(p, "text", "") or "" for p in parts)
```

`function_call` and `function_response` events **do** flow through this loop. But their parts carry `p.function_call` / `p.function_response` with `p.text is None`, so `_final_text` returns `""` and the `if text:` guard skips them.

Every tool call the agent makes — every booking, every failure, every escalation — is already streaming past that line and being discarded. Most of Tier 1 is reading data you already have, not producing new data.

Nothing calls `event.get_function_calls()`, `event.get_function_responses()`, `event.is_final_response()`, or `event.usage_metadata`.

---

## A correctness issue to fix regardless of priorities

`escalate_to_human` in `tools/booking_tools.py` is, in full:

```python
async def escalate_to_human(reason: str) -> dict:
    log.info("Escalation requested: %s", reason)
    return {
        "escalated": True,
        "message": (
            "I've let our clinic team know — someone will follow up with you here shortly."
        ),
    }
```

The model paraphrases that `message` to the patient. **Nothing is persisted, nobody is notified, no state changes.** The `{"escalated": True}` flag is consumed by the LLM and evaporates.

So every patient who asks for a human is told someone will follow up, and no one is told. There is no record anyone could act on even if they wanted to.

The console has been built around fixing this rather than hiding it: once you persist the call (Tier 1 #3 and #4), the analytics page shows an **"Awaiting follow-up"** queue listing exactly these patients, with the reason and how long they have been waiting. That queue is currently empty because the data does not exist.

---

## Tier 1 — the console cannot work without these

| # | Change | File | Effort |
|---|---|---|---|
| 1 | **Per-message timestamps** | `runtime/history.py` | ~5 lines |
| 2 | **Session boundaries** | `runtime/history.py`, `runtime/turn.py` | small, but a design decision |
| 3 | **Capture tool calls** | `runtime/turn.py` | ~10 lines |
| 4 | **Persist the escalation** | falls out of #3 | ~5 lines |
| 5 | **Record failed turns** | `runtime/turn.py` | 2 lines |

### 1. Per-message timestamps — the blocking dependency

Add `ts` to each pushed message and `createdAt`/`updatedAt` to the parent document in `_append_turn_sync`:

```python
now = datetime.now(UTC)
get_db()[_COLLECTION].update_one(
    {"phone": phone},
    {
        "$push": {"messages": {"$each": [
            {"role": "user", "content": user_text, "ts": now},
            {"role": "assistant", "content": assistant_text, "ts": now},
        ]}},
        "$set": {"updatedAt": now},
        "$setOnInsert": {"createdAt": now},
    },
    upsert=True,
)
```

**Why it is first:** there is no time axis without it. Transcript ordering, conversation duration, the daily volume chart, the busiest-hours chart, date filtering — all of it rests on this one field. Everything else in Tier 2 depends on it transitively.

Safe to ship alone: `contextualize()` only reads `role` and `content`, so extra keys are inert, and existing documents keep working.

### 2. Session boundaries

`transcripts` is one immortal document per phone. A patient who texts in January and again in June appends to the same `messages` array, and `contextualize()` replays the January tail as "prior conversation" with no indication that six months passed.

Cheapest version, computed at append time: if `now − last_message_ts > 30 minutes`, start a new `session_id` (a uuid) and stamp it on subsequent messages. Have `contextualize()` replay only the current session.

Requires #1. This also improves the agent's own behaviour, not just the console's — the model stops being fed stale context from months ago.

### 3. Capture tool calls

In the same loop that already runs, alongside `_final_text(event)`:

```python
for call in event.get_function_calls() or []:
    pending[call.id] = {"name": call.name, "args": dict(call.args or {}), "t0": time.perf_counter()}

for response in event.get_function_responses() or []:
    started = pending.pop(response.id, None)
    tool_calls.append({
        "name": response.name,
        "args": (started or {}).get("args", {}),
        "result": dict(response.response or {}),
        "status": "error" if _looks_like_error(response.response) else "success",
        "durationMs": round((time.perf_counter() - started["t0"]) * 1000) if started else None,
    })
```

Persist `tool_calls` on the assistant message. Verify the helper names against your installed `google-adk` version — they were not vendored in the repo so I could not read the source.

**Please record failures, not just successes.** A tool that silently failed is the single most useful thing on the console when a booking did not happen, and it is invisible if only successes are stored.

### 4. Persist the escalation

Once #3 lands, "did this conversation ask for a human?" is a read over captured data. Set `needs_human: true`, `escalated_at`, and the `reason` on the session document.

Notification is optional and separate — the console *is* the queue. But `whatsapp/client.py::send_text_message` already exists, so pinging a staff number is a few lines if you want it.

### 5. Record failed turns

`append_turn` currently sits **after** an early return:

```python
except Exception:
    log.exception("Turn failed for %s", phone)
    return FALLBACK_REPLY      # ← append_turn never runs
```

A failed turn leaves no record at all: the patient's message is lost, the next turn's context has a hole, and the console cannot see that anything went wrong. Persist the user message plus an error marker before returning.

---

## Tier 2 — makes the console genuinely useful

### 6. Derive `outcome` from captured tool calls

No LLM call needed. Once #3 exists this is a pure function over the recorded calls — `book_appointment` succeeded → `appointment_booked`, `cancel_appointment` succeeded → `appointment_cancelled`, `escalate_to_human` fired → `escalated`, nothing → `no_resolution`. The full mapping is in [`agent-data-contract.md`](agent-data-contract.md) §4.

This drives the outcome column, the outcome chart, and the **booking completion rate** — which is now the headline number on the analytics page.

### 7. Summary, sentiment and language

One structured-output call over a finished conversation.

> ⚠️ **This cannot be bolted onto `clinic_receptionist`.** In ADK, setting `output_schema` on an `LlmAgent` is mutually exclusive with tool use — an agent with a schema cannot call tools. It must be a **separate** `LlmAgent` or a direct `generate_content` call with its own schema.

Depends on #2: without session boundaries you either re-summarise on every turn — which puts a second model call on the WhatsApp reply path and adds latency the patient feels — or never summarise at all.

### 8. Latency and token usage

`time.perf_counter()` around the runner loop, and `event.usage_metadata` read in the same pass as #3. Feeds the per-message latency shown in the transcript and the low-confidence warning.

### 9. Timestamps on `patients` and `appointments`

`appointments` has `createdAt` only; `cancel_appointment` does `{"$set": {"status": "Cancelled"}}` with no `cancelledAt`, so a cancellation is untimed and unattributed. `patients` has no timestamps at all.

The v1 Mongoose models had `{ timestamps: true }` throughout — the Python port lost it.

---

## Tier 3 — worth doing, not urgent

| # | Change | Note |
|---|---|---|
| 10 | Move capture into an ADK `BasePlugin` (`on_tool_start/end`, `on_event`) instead of inlining in `turn.py` | Cleaner seam once #3 works. Confirm `InMemoryRunner` forwards `plugins=`, or switch to a plain `Runner` with an explicit session service. |
| 11 | One document per session instead of an unbounded array | `messages` grows forever; the 16MB document limit is the eventual ceiling. The `[-20:]` cap is read-side only and does not bound storage. |
| 12 | Debounce rapid WhatsApp bubbles | `PLAN.md` §10 planned it; never built. Each bubble is a separate `background.add_task` with no ordering guarantee, so two fast messages race on `append_turn`. |
| 13 | Replay history as real ADK `Content` turns, not flattened prose | `contextualize()` renders history as `"Patient: … / Assistant: …"` text, so the model never sees prior *tool results* — only the prose it produced. Anything relying on recalling an appointment id from two turns ago is unreliable today. |
| 14 | Tests for `run_turn`, `history.py`, `escalate_to_human` | All three have zero coverage; `run_turn` is monkeypatched in every existing test, so the ADK loop is never exercised. |
| 15 | Voice channel | The console already models it end to end. When it ships, set `ENABLED_CHANNELS=whatsapp,voice` in the console and the channel column, filter and split chart appear — no code change. |

---

## What the console does in the meantime

It runs on seeded demo data, and it hides what it cannot honestly show:

| Surface | Today | After Tier 1 |
|---|---|---|
| Channel column and filter | hidden — one channel is the same word on every row | appears automatically when voice ships |
| "Resolved without a human" KPI | hidden — pinned at 100% with no handoff | returns when `HUMAN_HANDOFF_ENABLED=true` |
| Headline KPI | **Booking completion rate** | unchanged — it stays meaningful either way |
| Escalations | **"Awaiting follow-up"** queue, empty until #4 | fills with real requests |
| Conversation list, transcripts, charts | seeded data only | real data once #1 and #2 land |

Both behaviours are config flags (`ENABLED_CHANNELS`, `HUMAN_HANDOFF_ENABLED`), not deletions — the schema, indexes and data layer already handle voice and handoff in full.

## Suggested order

**1 → 5 → 3 → 4 → 2**, then Tier 2.

Timestamps first because everything depends on them. Failed-turn recording next because it is two lines and you are otherwise blind to errors. Then tool capture and escalation, which together turn the follow-up queue on. Session boundaries last in Tier 1 because it is the only one needing a design decision rather than a patch.
