/*
 * Number formats for the analytics page, shared by server and client
 * components. A metric's format is named by a string kind (not a function)
 * so it can cross the Server/Client boundary to the count-up animation.
 */

/** Height of the volume chart and its skeleton, so nothing shifts on load. */
export const VOLUME_HEIGHT = 240;

export type MetricKind = "count" | "percent" | "duration" | "decimal";

const COUNT = new Intl.NumberFormat("en-IN");

export function formatMetric(kind: MetricKind, value: number): string {
  switch (kind) {
    case "count":
      return COUNT.format(Math.round(value));
    case "percent":
      return formatShare(value);
    case "duration":
      return formatHandlingTime(value);
    case "decimal":
      return value.toFixed(1);
  }
}

/** `64%`, but `4.5%` under ten, where the decimal still means something. */
export function formatShare(fraction: number): string {
  const percent = fraction * 100;
  if (percent > 0 && percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

/** `0:26` under a minute, `4m 10s` above. */
export function formatHandlingTime(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `0:${String(safe).padStart(2, "0")}`;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/** `18 Nov` on the clinic's calendar, for a `YYYY-MM-DD` key. */
export function formatDayKey(day: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(`${day}T12:00:00.000Z`));
}

/** `Tue, 18 Nov`, for chart tooltips. */
export function formatDayKeyLong(day: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).format(new Date(`${day}T12:00:00.000Z`));
}

/** Masks a phone number down to its last four digits: `•••• 8900`. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `•••• ${digits.slice(-4)}`;
}
