/*
 * Timezone helpers.
 *
 * Everything in Firestore is UTC, but a clinic thinks in local time: "how
 * many calls did we get on the 14th" and "when is our busiest hour" are both
 * questions about the wall clock in Asia/Kolkata, not about UTC. Getting this
 * wrong shifts every daily bucket by 5.5 hours and moves the evening peak
 * onto the wrong day.
 *
 * These use the built-in Intl database rather than a date library, so they
 * stay correct for any IANA zone including ones with daylight saving.
 */

/** Milliseconds to add to a UTC instant to get the wall clock in `timeZone`. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const parts = formatter.formatToParts(instant);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  // `hour` can come back as 24 for midnight in some runtimes.
  const hour = value("hour") % 24;

  const asIfUtc = Date.UTC(
    value("year"),
    value("month") - 1,
    value("day"),
    hour,
    value("minute"),
    value("second"),
  );

  return asIfUtc - instant.getTime();
}

/** The UTC instant of a given wall-clock time in `timeZone`. */
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  // One refinement pass settles the chicken-and-egg between the offset and
  // the instant it is measured at, including across a DST boundary.
  let utc = target - zoneOffsetMs(new Date(target), timeZone);
  utc = target - zoneOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY.test(value);
}

/** First instant of a `YYYY-MM-DD` day in the clinic's timezone, as UTC ISO. */
export function zonedStartOfDay(date: string, timeZone: string): string | null {
  const match = DATE_ONLY.exec(date);
  if (!match) return null;
  return zonedWallClockToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    0,
    0,
    0,
    timeZone,
  ).toISOString();
}

/** Last instant of a `YYYY-MM-DD` day in the clinic's timezone, as UTC ISO. */
export function zonedEndOfDay(date: string, timeZone: string): string | null {
  const match = DATE_ONLY.exec(date);
  if (!match) return null;
  return zonedWallClockToUtc(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    23,
    59,
    59,
    timeZone,
  ).toISOString();
}

/** The parts of an instant as they read on the clinic's wall clock. */
function zonedParts(iso: string, timeZone: string) {
  const instant = new Date(iso);
  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, timeZone));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(),
  };
}

/** `YYYY-MM-DD` as the clinic would write it. Used to bucket daily charts. */
export function zonedDayKey(iso: string, timeZone: string): string {
  const { year, month, day } = zonedParts(iso, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Hour 0–23 on the clinic's wall clock. Used by the busiest-hours chart. */
export function zonedHour(iso: string, timeZone: string): number {
  return zonedParts(iso, timeZone).hour;
}

/** `YYYY-MM-DD` for today in the clinic's timezone. */
export function zonedToday(timeZone: string, now = new Date()): string {
  return zonedDayKey(now.toISOString(), timeZone);
}

/** Shifts a `YYYY-MM-DD` by a whole number of days, staying calendar-correct. */
export function addDaysToDateKey(date: string, days: number): string {
  const match = DATE_ONLY.exec(date);
  if (!match) return date;
  const shifted = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) +
      days * 86400000,
  );
  return shifted.toISOString().slice(0, 10);
}

/** Whole days between two `YYYY-MM-DD` keys, inclusive of both ends. */
export function daysBetweenKeys(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.round((end - start) / 86400000) + 1;
}

/** A date/time formatted on the clinic's clock, for display only. */
export function formatInZone(
  iso: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat("en-IN", { ...options, timeZone }).format(
    new Date(iso),
  );
}
