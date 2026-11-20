"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { CircleAlert, Loader2, MailSearch } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDayKey } from "@/components/analytics/format";
import {
  getFailureReportAction,
  sendFailureReportAction,
} from "@/lib/failure-reports/actions";
import type { FailureReportJob } from "@/lib/data/failure-reports";
import { cn } from "@/lib/utils";

const POLL_MS = 3000;
const DEFAULT_LATEST = 10;

type Mode = "range" | "latest";

/**
 * "Send failures report": the agent reviews the chats it couldn't finish,
 * works out why from their traces, and emails what to fix.
 *
 * Two scopes: the page's date range (thorough, can take minutes), or only the
 * latest N failed chats (quick). While a report is being prepared the button
 * shows it, polls the job, and confirms with a toast when the email has gone.
 * A report already running when the page loads (another tab, another admin)
 * picks up the same way.
 */
export function FailureReportButton({
  from,
  to,
  timeZone,
  maxLatest,
  initialJob,
}: {
  from: string;
  to: string;
  timeZone: string;
  maxLatest: number;
  initialJob: FailureReportJob | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [mode, setMode] = React.useState<Mode>("range");
  const [limit, setLimit] = React.useState(String(DEFAULT_LATEST));
  const [error, setError] = React.useState<string | null>(null);
  const [job, setJob] = React.useState<FailureReportJob | null>(initialJob);
  const [isPending, startTransition] = React.useTransition();

  const running = job !== null && (job.status === "pending" || job.status === "processing");
  const rangeLabel = `${formatDayKey(from, timeZone)} – ${formatDayKey(to, timeZone)}`;

  // Poll the running job until the agent finishes it.
  React.useEffect(() => {
    if (!running || !job) return;
    const id = job.id;
    let cancelled = false;
    const timer = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      const result = await getFailureReportAction(id);
      if (cancelled) return;
      if (!result.ok) {
        setJob(null);
        toast.error("Couldn't check on the failures report", { description: result.error });
        return;
      }
      const next = result.job;
      if (next.status === "done") {
        setJob(null);
        const r = next.report;
        toast.success("Failures report sent", {
          description: r
            ? r.failed === 0
              ? `No failed chats in ${r.scope}. Emailed to ${r.emailedTo}.`
              : `${r.analysed} of ${r.failed} failed chats reviewed. Emailed to ${r.emailedTo}.`
            : undefined,
        });
      } else if (next.status === "failed") {
        setJob(null);
        toast.error("Couldn't send the failures report", {
          description: next.lastError ?? "The agent gave up after several tries.",
        });
      } else {
        setJob(next);
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [running, job]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const n = Number.parseInt(limit, 10);
    if (mode === "latest" && (!Number.isFinite(n) || n < 1 || n > maxLatest)) {
      setError(`Enter a number from 1 to ${maxLatest}.`);
      return;
    }
    startTransition(async () => {
      const result = await sendFailureReportAction(
        mode === "latest" ? { mode, limit: n } : { mode, from, to },
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setJob(result.job);
      setOpen(false);
      if (result.alreadyRunning) {
        toast("A failures report is already being prepared", {
          description: "You'll see a message here when it's emailed.",
        });
      }
    });
  }

  if (running) {
    return (
      <Button variant="outline" disabled aria-busy="true" className="disabled:opacity-100">
        <Loader2 className="text-agent animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span role="status">Preparing failures report…</span>
      </Button>
    );
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setError(null);
      }}
    >
      <Popover.Trigger asChild>
        <Button variant="outline">
          <MailSearch aria-hidden="true" />
          Send failures report
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="bg-surface border-line z-50 w-[340px] rounded-xl border p-4 shadow-(--shadow-pop)"
        >
          <form onSubmit={onSubmit} noValidate>
            <p className="text-ink text-sm font-medium">Send failures report</p>
            <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">
              The agent reviews chats it couldn&apos;t finish, works out why, and emails what to
              fix.
            </p>

            <fieldset className="mt-3 flex flex-col gap-2">
              <legend className="sr-only">Which chats to review</legend>

              <ScopeOption
                label={`Chats from ${rangeLabel}`}
                checked={mode === "range"}
                onSelect={() => setMode("range")}
                title="Chats in this date range"
                hint={<span className="tnum">{rangeLabel} · can take several minutes</span>}
              />

              <ScopeOption
                label="Only the latest failed chats"
                checked={mode === "latest"}
                onSelect={() => setMode("latest")}
                title={
                  <span className="flex items-center gap-1.5">
                    Only the latest
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={maxLatest}
                      value={limit}
                      aria-label="How many failed chats"
                      onFocus={() => setMode("latest")}
                      onChange={(event) => setLimit(event.target.value)}
                      className="tnum h-7 w-14 px-2 text-center text-[13px] md:text-[13px]"
                    />
                    failed chats
                  </span>
                }
                hint="Quicker · from any date"
              />
            </fieldset>

            {error && (
              <p role="alert" className="text-danger-text mt-3 flex items-start gap-1.5 text-[13px]">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {error}
              </p>
            )}

            <Button type="submit" className="mt-4 w-full" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Send report
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function ScopeOption({
  label,
  checked,
  onSelect,
  title,
  hint,
}: {
  label: string;
  checked: boolean;
  onSelect: () => void;
  title: React.ReactNode;
  hint: React.ReactNode;
}) {
  return (
    // A div, not a label: the "latest" option holds its own number input.
    <div
      onClick={onSelect}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-[10px] border px-3 py-2.5 transition-colors duration-(--dur-quick)",
        checked ? "border-agent bg-agent-soft" : "border-line hover:bg-surface-hover hover:border-line-strong",
      )}
    >
      <input
        type="radio"
        name="failure-report-scope"
        checked={checked}
        onChange={onSelect}
        className="accent-agent mt-1 size-3.5 shrink-0"
        aria-label={label}
      />
      <div className="min-w-0 text-[13px] leading-[18px]">
        <div className={cn("font-medium", checked ? "text-agent-text" : "text-ink")}>{title}</div>
        <div className="text-ink-3 mt-0.5">{hint}</div>
      </div>
    </div>
  );
}
