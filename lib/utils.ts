/*
 * `cn` is re-exported from the package the shadcn/ui components themselves
 * import, so application code and the primitives merge classes through one
 * implementation. Import it from here or from "cn" — they are the same thing.
 */
export { cn } from "cn";

/** `m:ss` for a duration in seconds — the form used in every table cell. */
export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

/** Longer form for the metadata rail, where there is room for units. */
export function formatDurationLong(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  if (safe < 60) return `${safe}s`;
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatPercent(value: number, fractionDigits = 0): string {
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-IN").format(value);
}

/** Splits a phone number into readable groups without changing its digits. */
export function formatPhone(phone: string): string {
  const match = /^(\+91)(\d{5})(\d{5})$/.exec(phone.replace(/\s/g, ""));
  if (!match) return phone;
  return `${match[1]} ${match[2]} ${match[3]}`;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Tokens used by the conversations search box.
 *
 * Firestore has no substring search, so search is an `array-contains` match
 * against a denormalized token array. We store every name part, the doctor's
 * name parts, and progressively longer digit suffixes of the phone number, so
 * a receptionist can paste the last four, six or ten digits off a caller ID.
 * A query only matches if it equals one of these tokens — typing "meht" will
 * not find "Mehta". Callers must not work around this by loading every
 * document into memory.
 */
export function buildSearchTokens(input: {
  patientName: string;
  phone: string;
  doctorName: string | null;
}): string[] {
  const tokens = new Set<string>();

  const addWords = (value: string) => {
    const lower = value.toLowerCase().trim();
    if (lower.length > 0) tokens.add(lower);
    for (const part of lower.split(/[^a-z0-9]+/)) {
      if (part.length > 1) tokens.add(part);
    }
  };

  addWords(input.patientName);
  if (input.doctorName) addWords(input.doctorName);

  const digits = input.phone.replace(/\D/g, "");
  if (digits.length > 0) {
    tokens.add(digits);
    for (const length of [4, 5, 6, 10]) {
      if (digits.length >= length) tokens.add(digits.slice(-length));
    }
  }

  return [...tokens];
}

/** Normalizes what the user typed into the shape `buildSearchTokens` stores. */
export function normalizeSearchQuery(query: string): string {
  const trimmed = query.trim().toLowerCase();
  const digits = trimmed.replace(/\D/g, "");
  // A query that is mostly digits is a phone lookup; keep only the digits so
  // "+91 98765 43210" and "9876543210" hit the same token.
  if (digits.length >= 4 && digits.length / trimmed.length > 0.5) return digits;
  return trimmed;
}

export function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
