import { HeartPulse } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The product mark: a petrol tile (petrol is the agent) beside the name.
 * Not the headset, which now means "Escalations" in the nav.
 */
export function BrandMark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "bg-agent flex shrink-0 items-center justify-center rounded-[9px] text-white",
          size === "lg" ? "size-8" : "size-7",
        )}
      >
        <HeartPulse className={size === "lg" ? "size-[18px]" : "size-4"} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className={cn("text-ink font-semibold", size === "lg" ? "text-base" : "text-[15px]")}>
        Medi Desk AI
      </span>
    </span>
  );
}
