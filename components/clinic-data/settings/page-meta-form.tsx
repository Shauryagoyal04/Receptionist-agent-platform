"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { FormField, SaveBar } from "@/components/clinic-data/form-bits";
import { setPageArchived, updatePageMeta } from "@/lib/clinic-data/actions";
import type { FieldDef } from "@/lib/clinic-data/model";

/** Name, description, agent access and title field of a custom page. */
export function PageMetaForm({
  entityType,
  version,
  initial,
  fields,
  archived,
}: {
  entityType: string;
  version: number;
  initial: {
    label: string;
    singularLabel: string;
    description: string;
    agentEnabled: boolean;
    titleField: string | null;
  };
  fields: FieldDef[];
  archived: boolean;
}) {
  const [meta, setMeta] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const titleCandidates = fields.filter(
    (f) => f.type === "text" && f.required && !f.archived,
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Page</CardTitle>
        <CardDescription>
          Slug <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">{entityType}</code>{" "}
          is permanent; everything else here can change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            setSaved(false);
            startTransition(async () => {
              const result = await updatePageMeta(entityType, version, meta);
              if (result.ok) {
                setErrors({});
                setSaved(true);
                router.refresh();
              } else {
                setError(result.error);
                setErrors(result.fieldErrors ?? {});
              }
            });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="meta-label" label="Name (plural)" required error={errors.label}>
              <Input
                id="meta-label"
                value={meta.label}
                onChange={(e) => setMeta({ ...meta, label: e.target.value })}
              />
            </FormField>
            <FormField id="meta-singular" label="Name (singular)" required error={errors.singularLabel}>
              <Input
                id="meta-singular"
                value={meta.singularLabel}
                onChange={(e) => setMeta({ ...meta, singularLabel: e.target.value })}
              />
            </FormField>
            <FormField
              id="meta-title"
              label="Title field"
              required
              error={errors.titleField}
              hint="A required text field; each row is listed by it."
            >
              <NativeSelect
                id="meta-title"
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
            <FormField
              id="meta-agent"
              label="Agent can search this page"
              hint="Changes reach patients within about a minute."
            >
              <div className="flex h-8 items-center">
                <Switch
                  id="meta-agent"
                  checked={meta.agentEnabled}
                  onCheckedChange={(agentEnabled) => setMeta({ ...meta, agentEnabled })}
                />
              </div>
            </FormField>
            <FormField
              id="meta-description"
              label="Description"
              error={errors.description}
              hint="Shown to staff and given to the agent."
              className="sm:col-span-2"
            >
              <Textarea
                id="meta-description"
                rows={2}
                maxLength={1000}
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              />
            </FormField>
          </div>
          <SaveBar pending={isPending} error={error} saved={saved} label="Save page">
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
                    toast.success(archived ? "Page restored" : "Page archived");
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
          </SaveBar>
        </form>
      </CardContent>
    </Card>
  );
}
