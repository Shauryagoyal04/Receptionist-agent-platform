"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField, SaveBar } from "@/components/clinic-data/form-bits";
import { createCustomPage } from "@/lib/clinic-data/actions";
import { suggestFieldKey, suggestSlug } from "@/lib/clinic-data/model";

/**
 * New custom page. A custom page always needs a required text title field,
 * so it's created in the same step; more fields are added afterwards.
 *
 * The slug and the title field's key follow the labels until the admin edits
 * them by hand, and both are permanent once saved.
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

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus />
        New page
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>New page</CardTitle>
        <CardDescription>
          A list of things your clinic offers, like lab tests, services or packages.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
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
                toast.success(`${label} created`);
                router.push(`/settings/data/${result.data.entityType}`);
              } else {
                setError(result.error);
                setErrors(result.fieldErrors ?? {});
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="label" label="Name (plural)" required error={errors.label} hint="Shown in navigation.">
              <Input
                id="label"
                value={label}
                placeholder="Lab tests"
                onChange={(e) => {
                  setLabel(e.target.value);
                  if (!slugTouched) setEntityType(suggestSlug(e.target.value));
                }}
              />
            </FormField>
            <FormField id="singularLabel" label="Name (singular)" required error={errors.singularLabel}>
              <Input
                id="singularLabel"
                value={singularLabel}
                placeholder="Lab test"
                onChange={(e) => setSingularLabel(e.target.value)}
              />
            </FormField>
            <FormField
              id="entityType"
              label="Slug"
              required
              error={errors.entityType}
              hint="Permanent. Lowercase letters, digits and underscores."
            >
              <Input
                id="entityType"
                value={entityType}
                className="font-mono"
                placeholder="lab_test"
                aria-invalid={Boolean(errors.entityType) || undefined}
                onChange={(e) => {
                  setSlugTouched(true);
                  setEntityType(e.target.value);
                }}
              />
            </FormField>
            <FormField
              id="agentEnabled"
              label="Agent can search this page"
              hint="The agent answers patients from active rows."
            >
              <div className="flex h-8 items-center">
                <Switch id="agentEnabled" checked={agentEnabled} onCheckedChange={setAgentEnabled} />
              </div>
            </FormField>
            <FormField
              id="description"
              label="Description"
              error={errors.description}
              hint="Shown to staff and given to the agent to explain what this page is."
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
              label="Title field"
              required
              error={errors.titleLabel}
              hint="Each row's name, e.g. the test name."
            >
              <Input
                id="titleLabel"
                value={titleLabel}
                onChange={(e) => {
                  setTitleLabel(e.target.value);
                  if (!keyTouched) setTitleKey(suggestFieldKey(e.target.value));
                }}
              />
            </FormField>
            <FormField
              id="titleKey"
              label="Title field key"
              required
              error={errors.titleKey ?? errors["fields.0.key"]}
              hint="Permanent. camelCase."
            >
              <Input
                id="titleKey"
                value={titleKey}
                className="font-mono"
                onChange={(e) => {
                  setKeyTouched(true);
                  setTitleKey(e.target.value);
                }}
              />
            </FormField>
          </div>
          <SaveBar pending={isPending} error={error} label="Create page">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </SaveBar>
        </form>
      </CardContent>
    </Card>
  );
}
