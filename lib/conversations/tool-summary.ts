import type { ToolInvocation } from "@/lib/types";

/*
 * A one-line, human summary of a tool call.
 *
 * The raw payload is always available behind the disclosure, but a reviewer
 * scanning a transcript should be able to read "Checked Dr. Mehta's
 * availability for 14 Oct" rather than parse JSON. The args come from an
 * external agent, so every field is read defensively — a missing or oddly
 * typed value degrades to a plainer sentence instead of throwing.
 */

function str(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** Renders an ISO date, a `YYYY-MM-DD`, or a already-friendly string. */
function readableDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Kolkata",
  }).format(parsed);
}

/** Possessive form that reads correctly for names already ending in s. */
function possessive(name: string): string {
  return name.endsWith("s") ? `${name}'` : `${name}'s`;
}

export function summarizeToolCall(tool: ToolInvocation): string {
  const args = tool.args;
  const doctor = str(args, "doctor");
  const date = readableDate(str(args, "date") ?? str(args, "slot") ?? str(args, "newSlot"));
  const phone = str(args, "phone");

  switch (tool.name) {
    case "check_availability": {
      if (doctor && date) return `Checked ${possessive(doctor)} availability for ${date}`;
      if (doctor) return `Checked ${possessive(doctor)} availability`;
      return "Checked appointment availability";
    }
    case "book_appointment": {
      if (doctor && date) return `Booked ${doctor} on ${date}`;
      if (doctor) return `Booked an appointment with ${doctor}`;
      return "Booked an appointment";
    }
    case "reschedule_appointment": {
      if (doctor && date) return `Moved the ${doctor} appointment to ${date}`;
      return date ? `Moved the appointment to ${date}` : "Rescheduled the appointment";
    }
    case "cancel_appointment": {
      return doctor ? `Cancelled the ${doctor} appointment` : "Cancelled the appointment";
    }
    case "lookup_patient": {
      return phone ? `Looked up the patient record for ${phone}` : "Looked up the patient record";
    }
    case "send_confirmation": {
      const channel = str(args, "channel");
      const via = channel === "whatsapp" ? "WhatsApp" : channel === "sms" ? "SMS" : null;
      return via ? `Sent a confirmation by ${via}` : "Sent a confirmation";
    }
    case "fetch_report_status": {
      return "Checked whether the lab report was ready";
    }
    case "quote_fees": {
      const type = str(args, "type");
      return type ? `Looked up ${type} consultation fees` : "Looked up consultation fees";
    }
    default: {
      // An unrecognized tool still gets a readable line rather than a blank.
      return `Called ${tool.name.replace(/_/g, " ")}`;
    }
  }
}
