import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 text-[15px] text-ink transition-[border-color,box-shadow] duration-(--dur-quick) outline-none placeholder:text-ink-4 hover:border-ink-4 focus-visible:border-agent focus-visible:shadow-[0_0_0_3px_var(--agent-soft)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-60 aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_var(--danger-soft)] md:text-sm file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
        className
      )}
      {...props}
    />
  )
}

export { Input }
