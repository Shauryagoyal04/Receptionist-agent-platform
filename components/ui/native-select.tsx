import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "cn"

/**
 * A styled native <select>. Native rather than a Radix listbox because it is
 * the most usable control on phones, works inside plain GET filter forms
 * without JavaScript, and matches `Input`'s height and focus ring.
 */
function NativeSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <div className={cn("relative w-full min-w-0", className)}>
      <select
        data-slot="native-select"
        className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
    </div>
  )
}

export { NativeSelect }
