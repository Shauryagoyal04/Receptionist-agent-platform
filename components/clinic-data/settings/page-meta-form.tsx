"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/clinic-data/form-bits";
import { setPageArchived, updatePageMeta } from "@/lib/clinic-data/actions";
import type { FieldDef } from "@/lib/clinic-data/model";

type Meta = {
  label: string;
  singularLabel: string;
  description: string;
  agentEnabled: boolean;
  titleField: string | null;
};

const META_KEYS: Array<keyof Meta> = ["label", "singularLabel", "description", "agentEnabled", "titleField"];

/**
 * Name, description, agent access and title field of a clinic page.
 *
 * Edits are held locally; a save bar slides up from the bottom while there
 * are unsaved changes, and leaving the page with changes asks first.
 */
export function PageMetaForm({
  entityType,
  version,
  initial,
  fields,
  archived,
}: {
  entityType: string;
  version: number;
  initial: Meta;
  fields: FieldDef[];
  archived: boolean;
}) {
  const [meta, setMeta] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const titleCandidates = fields.filter((f) => f.type === "text" && f.required && !f.archived);
  const changed = META_KEYS.filter((key) => meta[key] !== initial[key]).length;
  const dirty = changed > 0;

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updatePageMeta(entityType, version, meta);
      if (result.ok) {
        setErrors({});
        toast.success("Page details saved", {
          description: "The agent uses them within a minute.",
        });
        router.refresh();
      } else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <section
      aria-labelledby="meta-title"
      className="bg-surface border-line rounded-xl border"
    >
      <header className="px-5 pt-5">
        <h2 id="meta-title" className="text-ink text-[17px] leading-6 font-semibold">
          Page details
        </h2>
        <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">
          The web address{" "}
          <code className="bg-sunken text-ink-2 rounded px-1.5 py-0.5 font-mono text-xs">
            /data/{entityType}
          </code>{" "}
          is permanent. Everything else here can change.
        </p>
      </header>

      <form
        className="px-5 pt-5 pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="meta-label" label="Name" required error={errors.label} hint="Shown in the sidebar, e.g. Lab tests.">
            <Input
              id="meta-label"
              className="h-11"
              value={meta.label}
              onChange={(e) => setMeta({ ...meta, label: e.target.value })}
            />
          </FormField>
          <FormField
            id="meta-singular"
            label="One item is called"
            required
            error={errors.singularLabel}
            hint="Used on buttons, e.g. Add lab test."
          >
            <Input
              id="meta-singular"
              className="h-11"
              value={meta.singularLabel}
              onChange={(e) => setMeta({ ...meta, singularLabel: e.target.value })}
            />
          </FormField>
          <FormField
            id="meta-description"
            label="What this page is for"
            error={errors.description}
            hint="Staff see it at the top of the page, and the agent reads it to know when to look here."
            className="sm:col-span-2"
          >
            <Textarea
              id="meta-description"
              rows={2}
              maxLength={1000}
              value={meta.description}
              placeholder="Pathology tests we run in-house, with price and report turnaround."
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            />
          </FormField>
          <FormField
            id="meta-title"
            label="Each row is named by"
            required
            error={errors.titleField}
            hint="A required text field. Rows are listed and searched by it."
          >
            <NativeSelect
              id="meta-title"
              className="[&_select]:h-11"
              value={meta.titleField ?? ""}
              onChange={(e) => setMeta({ ...meta, titleField: e.target.value || null })}
            >
              {titleCandidates.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium" id="meta-agent-label">
              Agent can search this page
            </span>
            <label
              htmlFor="meta-agent"
              className="border-line-strong hover:border-ink-4 flex h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 transition-colors duration-(--dur-quick)"
            >
              <Switch
                id="meta-agent"
                aria-labelledby="meta-agent-label"
                checked={meta.agentEnabled}
                onCheckedChange={(agentEnabled) => setMeta({ ...meta, agentEnabled })}
              />
              <span className="text-ink-2 text-sm">
                {meta.agentEnabled ? "On: answers patients from active rows" : "Off: staff only"}
              </span>
            </label>
          </div>
        </div>

        {error && (
          <p role="alert" className="text-danger-text mt-4 text-[13px]">
            {error}
          </p>
        )}

        {/* Save bar: slides up while there are unsaved changes. */}
        {dirty && (
          <div
            role="region"
            aria-label="Unsaved changes"
            className="animate-in fade-in slide-in-from-bottom-4 fixed inset-x-4 bottom-4 z-40 duration-200 lg:left-[calc(248px+2rem)] lg:max-w-[calc(1280px-4rem)]"
          >
            <div className="bg-ink text-surface mx-auto flex max-w-3xl items-center gap-3 rounded-xl px-4 py-3 shadow-(--shadow-pop)">
              <span className="tnum flex-1 text-sm">
                {changed} unsaved {changed === 1 ? "change" : "changes"}
              </span>
              <Button
                type="button"
                variant="ghost"
                className="text-surface hover:bg-white/10 hover:text-surface"
                disabled={isPending}
                onClick={() => {
                  setMeta(initial);
                  setErrors({});
                  setError(null);
                }}
              >
                Discard
              </Button>
              <Button type="submit" disabled={isPending} className="min-w-36">
                {isPending && <Loader2 className="animate-spin" />}
                Save page details
              </Button>
            </div>
          </div>
        )}
      </form>

      <div className="border-line flex flex-wrap items-center gap-3 border-t px-5 py-4">
        <p className="text-ink-3 min-w-0 flex-1 text-[13px]">
          {archived
            ? "This page is archived. Restoring it brings it back for staff and the agent."
            : "Archiving hides this page from staff and the agent. Rows are kept and it can be restored."}
        </p>
        <Button
          type="button"
          variant={archived ? "outline" : "destructive"}
          disabled={isPending}
          onClick={() => {
            if (
              !archived &&
              !window.confirm(
                `Archive "${initial.label}"? It disappears from the console and the agent; its rows are kept and it can be restored.`,
              )
            ) {
              return;
            }
            startTransition(async () => {
              const result = await setPageArchived(entityType, version, !archived);
              if (result.ok) {
                toast.success(archived ? `${initial.label} restored` : `${initial.label} archived`);
                router.refresh();
              } else {
                toast.error(result.error);
              }
            });
          }}
        >
          {archived ? <ArchiveRestore /> : <Archive />}
          {archived ? "Restore page" : "Archive page"}
        </Button>
      </div>
    </section>
  );
}
