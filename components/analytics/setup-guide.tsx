import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type SetupStep = {
  id: string;
  label: string;
  done: boolean;
  /** Where to fix it. Omitted when the viewer can't open that page. */
  href?: string;
  hrefLabel?: string;
};

/**
 * Shown at the top of Analytics until the first conversation arrives, in
 * place of a page of empty charts. Each open step links to the exact place
 * to fix it.
 */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const done = steps.filter((step) => step.done).length;
  return (
    <section
      aria-labelledby="setup-title"
      className="bg-surface border-line rounded-2xl border p-6"
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="min-w-0 flex-1">
          <h2 id="setup-title" className="text-ink text-[17px] leading-6 font-semibold">
            Get the agent ready
          </h2>
          <p className="text-ink-3 mt-0.5 text-[13px]">
            The agent answers from what you set up here. Finish these and the charts below fill in on
            their own.
          </p>
        </div>
        <div className="flex w-56 items-center gap-3">
          <span className="tnum text-ink-2 shrink-0 text-[13px] font-medium">
            {done} of {steps.length} done
          </span>
          <span className="bg-sunken h-2 flex-1 overflow-hidden rounded-full">
            <span
              className="bg-agent md-grow-x block h-full rounded-full"
              style={{ width: `${(done / steps.length) * 100}%` }}
            />
          </span>
        </div>
      </div>

      <ol className="mt-5 flex flex-col">
        {steps.map((step) => (
          <li key={step.id} className="border-line flex min-h-12 items-center gap-3 border-t py-2">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full",
                step.done ? "bg-booked-soft text-booked" : "border-line-strong border-[1.5px] border-dashed",
              )}
            >
              {step.done && <Check className="size-3.5" strokeWidth={2.5} aria-hidden="true" />}
              <span className="sr-only">{step.done ? "Done:" : "To do:"}</span>
            </span>
            <span className={cn("text-sm", step.done ? "text-ink-3" : "text-ink")}>{step.label}</span>
            {!step.done && step.href && (
              <Link
                href={step.href}
                className="group/link text-agent-text hover:text-agent ml-auto flex shrink-0 items-center gap-1 text-[13px] font-medium"
              >
                {step.hrefLabel}
                <ArrowRight className="size-3.5 transition-transform duration-(--dur-quick) group-hover/link:translate-x-0.5" />
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
