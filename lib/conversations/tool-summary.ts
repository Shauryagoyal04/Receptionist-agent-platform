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
  const doctor = str(args, "doctor_name") ?? str(args, "doctor");
  const date = readableDate(str(args, "date") ?? str(args, "slot") ?? str(args, "newSlot"));
  const phone = str(args, "phone");

  switch (tool.name) {
    case "get_clinic_info": {
      return "Looked up the clinic's timings, address and contact details";
    }
    case "list_doctors": {
      return "Listed the doctors currently taking appointments";
    }
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
    case "list_my_appointments": {
      return phone
        ? `Listed upcoming appointments for ${phone}`
        : "Listed the patient's upcoming appointments";
    }
    case "cancel_appointment": {
      return doctor ? `Cancelled the ${doctor} appointment` : "Cancelled the appointment";
    }
    case "escalate_to_human": {
      const reason = str(args, "reason");
      // The agent tells the patient a person will follow up; nothing notifies
      // one. Say what actually happened rather than repeating the promise.
      return reason
        ? `Patient asked for a human — ${reason}`
        : "Patient asked for a human";
    }
    default: {
      // An unrecognized tool still gets a readable line rather than a blank.
      return `Called ${tool.name.replace(/_/g, " ")}`;
    }
  }
}
