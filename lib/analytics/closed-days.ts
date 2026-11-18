/*
 * Which weekdays the clinic is closed, read from the free-text "timings" on
 * the Clinic page (e.g. "Mon–Sat 9 AM – 8 PM, Sunday closed").
 *
 * The text is written by people, so this is deliberately cautious: a weekday
 * counts as closed only when it sits in the same clause as the word "closed"
 * or "holiday". When nothing matches, no days are shaded — a missing band is
 * harmless, a wrong one tells staff the clinic shut on a day it was open.
 */

const WEEKDAYS: Array<{ index: number; pattern: RegExp }> = [
  { index: 0, pattern: /\bsun(day)?s?\b/i },
  { index: 1, pattern: /\bmon(day)?s?\b/i },
  { index: 2, pattern: /\btue(s|sday)?s?\b/i },
  { index: 3, pattern: /\bwed(nesday)?s?\b/i },
  { index: 4, pattern: /\bthu(r|rs|rsday)?s?\b/i },
  { index: 5, pattern: /\bfri(day)?s?\b/i },
  { index: 6, pattern: /\bsat(urday)?s?\b/i },
];

const CLOSED = /\b(closed|holiday|off)\b/i;

/** Weekday indexes (0 = Sunday) the clinic is closed on. */
export function closedWeekdays(timings: string | null): number[] {
  if (!timings) return [];
  const closed = new Set<number>();
  // Clauses are split on punctuation and line breaks, not on spaces or
  // dashes, so "Mon–Sat 9–8" stays one clause.
  for (const clause of timings.split(/[,;.\n|]+/)) {
    if (!CLOSED.test(clause)) continue;
    for (const day of WEEKDAYS) {
      if (day.pattern.test(clause)) closed.add(day.index);
    }
  }
  return [...closed].sort();
}

/** Weekday index of a `YYYY-MM-DD` calendar day. */
export function weekdayOfKey(day: string): number {
  return new Date(`${day}T12:00:00.000Z`).getUTCDay();
}
