"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/clinic-data/form-bits";
import { createCustomPage } from "@/lib/clinic-data/actions";
import { suggestFieldKey, suggestSlug } from "@/lib/clinic-data/model";

/** Common clinic pages, offered so the form never starts blank. */
const SUGGESTIONS = [
  { label: "Services & charges", singular: "Service", title: "Service name", description: "Consultations, procedures and packages, with what each costs." },
  { label: "Lab tests", singular: "Lab test", title: "Test name", description: "Pathology tests we run in-house, with price and report turnaround." },
  { label: "Subsidies & schemes", singular: "Scheme", title: "Scheme name", description: "Government and insurance schemes the clinic accepts, and who qualifies." },
  { label: "Staff", singular: "Staff member", title: "Name", description: "Nurses and front-desk staff patients may ask for." },
];

/**
 * New clinic page. A clinic page always needs a required text title field,
 * so it's created in the same step; more fields are added afterwards.
 *
 * The web address and the title field's key follow the names until the admin
 * edits them by hand, and both are permanent once saved, so they sit under
 * "Technical names" and open on their own when one has an error.
 */
export function CreatePageForm() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [singularLabel, setSingularLabel] = useState("");
  const [entityType, setEntityType] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [titleLabel, setTitleLabel] = useState("Name");
  const [titleKey, setTitleKey] = useState("name");
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const technicalError = errors.entityType ?? errors.titleKey ?? errors["fields.0.key"];

  function applyLabel(next: string) {
    setLabel(next);
    if (!slugTouched) setEntityType(suggestSlug(next));
  }

  function applyTitle(next: string) {
    setTitleLabel(next);
    if (!keyTouched) setTitleKey(suggestFieldKey(next));
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus />
        New page
      </Button>
    );
  }

  return (
    <section
      aria-labelledby="new-page-title"
      className="bg-surface border-line animate-in fade-in slide-in-from-top-1 rounded-xl border duration-200"
    >
      <header className="px-5 pt-5">
        <h3 id="new-page-title" className="text-ink text-[17px] leading-6 font-semibold">
          New page
        </h3>
        <p className="text-ink-3 mt-0.5 text-[13px] leading-[18px]">
          A list the clinic keeps, such as services and charges, lab tests or schemes. You add its
          fields next.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
        <span className="text-ink-3 text-[13px]">Start from:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => {
              applyLabel(s.label);
              setSingularLabel(s.singular);
              setDescription(s.description);
              applyTitle(s.title);
            }}
            className="border-line-strong text-ink-2 hover:border-agent hover:bg-agent-soft hover:text-agent-text inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] transition-colors duration-(--dur-quick)"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-5 p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          startTransition(async () => {
            const result = await createCustomPage({
              entityType,
              label,
              singularLabel,
              description,
              agentEnabled,
              titleLabel,
              titleKey,
            });
            if (result.ok) {
              toast.success(`${label} created`, { description: "Now add the fields it should keep." });
              router.push(`/settings/data/${result.data.entityType}`);
            } else {
              setError(result.error);
              setErrors(result.fieldErrors ?? {});
            }
          });
        }}
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="label" label="Name" required error={errors.label} hint="Shown in the sidebar.">
            <Input
              id="label"
              className="h-11"
              value={label}
              placeholder="Lab tests"
              onChange={(e) => applyLabel(e.target.value)}
            />
          </FormField>
          <FormField
            id="singularLabel"
            label="One item is called"
            required
            error={errors.singularLabel}
            hint="Used on buttons, e.g. Add lab test."
          >
            <Input
              id="singularLabel"
              className="h-11"
              value={singularLabel}
              placeholder="Lab test"
              onChange={(e) => setSingularLabel(e.target.value)}
            />
          </FormField>
          <FormField
            id="description"
            label="What this page is for"
            error={errors.description}
            hint="Staff see it on the page, and the agent reads it to know when to look here."
            className="sm:col-span-2"
          >
            <Textarea
              id="description"
              rows={2}
              value={description}
              maxLength={1000}
              placeholder="Pathology tests we run in-house, with price and report turnaround."
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          <FormField
            id="titleLabel"
            label="Each row is named by"
            required
            error={errors.titleLabel}
            hint="The first field, e.g. Test name."
          >
            <Input
              id="titleLabel"
              className="h-11"
              value={titleLabel}
              onChange={(e) => applyTitle(e.target.value)}
            />
          </FormField>
          <div className="flex flex-col gap-1.5">
            <span className="text-ink text-sm font-medium" id="agentEnabled-label">
              Agent can search this page
            </span>
            <label
              htmlFor="agentEnabled"
              className="border-line-strong hover:border-ink-4 flex h-11 cursor-pointer items-center gap-3 rounded-[10px] border px-3 transition-colors duration-(--dur-quick)"
            >
              <Switch
                id="agentEnabled"
                aria-labelledby="agentEnabled-label"
                checked={agentEnabled}
                onCheckedChange={setAgentEnabled}
              />
              <span className="text-ink-2 text-sm">
                {agentEnabled ? "On: answers patients from active rows" : "Off: staff only"}
              </span>
            </label>
          </div>
        </div>

        <details open={Boolean(technicalError) || undefined} className="group/tech">
          <summary className="text-ink-3 hover:text-ink-2 flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md text-[13px] font-medium transition-colors duration-(--dur-quick) [&::-webkit-details-marker]:hidden">
            <ChevronRight
              aria-hidden="true"
              className="size-3.5 transition-transform duration-(--dur-base) group-open/tech:rotate-90"
            />
            Technical names
            <span className="text-ink-4 font-normal">
              · /data/{entityType || "…"} · {titleKey || "…"}
            </span>
          </summary>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <FormField
              id="entityType"
              label="Web address"
              required
              error={errors.entityType}
              hint="Permanent. Lowercase letters, digits and underscores."
            >
              <Input
                id="entityType"
                value={entityType}
                className="h-11 font-mono"
                placeholder="lab_test"
                aria-invalid={Boolean(errors.entityType) || undefined}
                onChange={(e) => {
                  setSlugTouched(true);
                  setEntityType(e.target.value);
                }}
              />
            </FormField>
            <FormField
              id="titleKey"
              label="Name field key"
              required
              error={errors.titleKey ?? errors["fields.0.key"]}
              hint="Permanent. camelCase, e.g. testName."
            >
              <Input
                id="titleKey"
                value={titleKey}
                className="h-11 font-mono"
                onChange={(e) => {
                  setKeyTouched(true);
                  setTitleKey(e.target.value);
                }}
              />
            </FormField>
          </div>
        </details>

        {error && (
          <p role="alert" className="text-danger-text text-[13px]">
            {error}
          </p>
        )}

        <div className="border-line -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t px-5 py-4">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending} className="min-w-32">
            {isPending && <Loader2 className="animate-spin" />}
            Create page
          </Button>
        </div>
      </form>
    </section>
  );
}
