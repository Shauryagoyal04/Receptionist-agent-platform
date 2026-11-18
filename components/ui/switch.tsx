"use client"

import * as React from "react"
import { cn } from "cn"
import { Switch as SwitchPrimitive } from "radix-ui"

function Switch({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  size?: "sm" | "default"
}) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-size={size}
      className={cn(
        "peer group/switch relative inline-flex shrink-0 items-center rounded-full border border-transparent transition-colors duration-(--dur-base) after:absolute after:-inset-x-3 after:-inset-y-2 aria-invalid:border-danger data-[size=default]:h-[22px] data-[size=default]:w-[38px] data-[size=sm]:h-4 data-[size=sm]:w-7 data-checked:bg-agent data-unchecked:bg-line-strong data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block rounded-full bg-white shadow-[0_1px_2px_rgba(23,38,42,.2)] transition-transform duration-(--dur-base) ease-(--ease-in-out) group-data-[size=default]/switch:size-[18px] group-data-[size=sm]/switch:size-3 data-unchecked:translate-x-0.5 group-data-[size=default]/switch:data-checked:translate-x-[16px] group-data-[size=sm]/switch:data-checked:translate-x-[12px]"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
