import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full min-w-0 rounded-[10px] border border-line-strong bg-surface px-3 py-2.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-(--dur-quick) outline-none placeholder:text-ink-4 hover:border-ink-4 focus-visible:border-agent focus-visible:shadow-[0_0_0_3px_var(--agent-soft)] focus-visible:outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-60 aria-invalid:border-danger aria-invalid:shadow-[0_0_0_3px_var(--danger-soft)] md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
