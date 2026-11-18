import { cn } from "@/lib/utils";

const DAYS = [
  { day: "Monday", letter: "M" },
  { day: "Tuesday", letter: "T" },
  { day: "Wednesday", letter: "W" },
  { day: "Thursday", letter: "T" },
  { day: "Friday", letter: "F" },
  { day: "Saturday", letter: "S" },
  { day: "Sunday", letter: "S" },
];

/**
 * A doctor's working days as seven dots, Monday first: filled petrol for a
 * day the agent can book, hollow for a day off. Faster to scan down a list
 * than "Mon, Tue, Thu, Sat".
 */
export function WeekStrip({ days, className }: { days: string[]; className?: string }) {
  const on = new Set(days);
  const label = DAYS.filter((d) => on.has(d.day)).map((d) => d.day).join(", ");
  return (
    <span
      role="img"
      aria-label={label ? `Works ${label}` : "No working days set"}
      className={cn("inline-flex items-center gap-1", className)}
    >
      {DAYS.map((d) => (
        <span key={d.day} aria-hidden="true" className="flex flex-col items-center gap-0.5">
          <span
            className={cn(
              "size-2 rounded-full",
              on.has(d.day) ? "bg-agent" : "shadow-[inset_0_0_0_1.5px_var(--line-strong)]",
            )}
          />
          <span className={cn("text-[10px] leading-3", on.has(d.day) ? "text-ink-2" : "text-ink-4")}>
            {d.letter}
          </span>
        </span>
      ))}
    </span>
  );
}
