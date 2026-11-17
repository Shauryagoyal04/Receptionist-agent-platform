import type { FieldDef } from "@/lib/clinic-data/model";

/**
 * A stored attribute value as table text. Values that don't match the
 * field's type (written by hand, or before a change) are shown as-is rather
 * than hidden, so staff can see and fix them.
 */
export function formatAttribute(field: FieldDef, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  if (field.type === "boolean" && typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "number" && typeof value === "number") {
    return value.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** "09:00"–"13:00" as "9:00 AM – 1:00 PM". */
export function formatTime(value: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return value || "—";
  const hours = Number(match[1]);
  const suffix = hours >= 12 ? "PM" : "AM";
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${match[2]} ${suffix}`;
}

/** Monday–Friday as "Mon–Fri"; anything else as a short list. */
export function formatDays(days: string[]): string {
  if (days.length === 0) return "—";
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const idx = days.map((d) => order.indexOf(d)).filter((i) => i >= 0).sort((a, b) => a - b);
  const short = (i: number) => order[i].slice(0, 3);
  const contiguous = idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  if (idx.length >= 3 && contiguous) return `${short(idx[0])}–${short(idx[idx.length - 1])}`;
  return idx.map(short).join(", ");
}
