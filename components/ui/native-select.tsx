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
        className="appearance-none pr-9 h-10 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink transition-[border-color,box-shadow] duration-(--dur-quick) outline-none placeholder:text-ink-4 hover:border-ink-4 focus-visible:border-agent focus-visible:shadow-[0_0_0_3px_var(--agent-soft)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-60 aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_var(--danger-soft)] md:text-sm"
        {...props}
      />
      <ChevronDown
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-3"
      />
    </div>
  )
}

export { NativeSelect }
