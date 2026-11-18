"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import {
  FormCard,
  FormField,
  SectionNav,
  StickySaveBar,
  ToggleChip,
  useDirty,
  useJustSaved,
  useUnsavedWarning,
  type NavSection,
} from "@/components/clinic-data/form-bits";
import {
  AttributeFields,
  toFormValues,
  toSubmitValues,
  type FormValue,
  type FormValues,
} from "@/components/clinic-data/field-input";
import { AgentPreview, type PreviewFact } from "@/components/clinic-data/agent-preview";
import { WeekStrip } from "@/components/clinic-data/week-strip";
import {
  saveClinicInfo,
  saveDoctor,
  savePatient,
  saveRecord,
} from "@/lib/clinic-data/actions";
import { formatDays, formatTime } from "@/lib/clinic-data/format";
import {
  GENDERS,
  WEEKDAYS,
  activeFields,
  type Attributes,
  type FieldDef,
  type Gender,
  type Weekday,
} from "@/lib/clinic-data/model";
import { initialsOf } from "@/lib/utils";

/*
 * Create / edit forms for the clinic, doctors, patients and custom-page rows.
 * Core fields are fixed inputs; clinic-defined fields are rendered from the
 * page definition. All four submit JSON to a Server Action, which validates
 * again and returns per-field errors keyed like "workingHours.end" or
 * "attributes.price".
 *
 * Each form tracks what changed since the last save, shows a sticky save bar
 * with the count and a Discard, and warns before the tab closes with unsaved
 * changes.
 */

const ATTR = "attr:";

function useAttributeState(fields: FieldDef[], stored: Attributes) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(fields, stored));
  const set = (key: string, value: FormValue) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  return {
    values,
    set,
    replace: setValues,
    submit: () => toSubmitValues(fields, values),
  };
}

/** Attribute values keyed `attr:<key>`, to sit beside core fields in one snapshot. */
function prefixed(values: FormValues): Record<string, FormValue> {
  return Object.fromEntries(Object.entries(values).map(([k, v]) => [`${ATTR}${k}`, v]));
}

function unprefixed(snapshot: Record<string, unknown>): FormValues {
  return Object.fromEntries(
    Object.entries(snapshot)
      .filter(([k]) => k.startsWith(ATTR))
      .map(([k, v]) => [k.slice(ATTR.length), v as FormValue]),
  );
}

function isFilled(value: unknown): boolean {
  if (typeof value === "boolean") return true;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" ? value.trim() !== "" : value !== null && value !== undefined;
}

function useSubmit() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { justSaved, flash } = useJustSaved();

  function run(
    action: () => Promise<
      { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }
    >,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setErrors({});
        flash();
        onOk?.();
      } else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }
  function clearErrors() {
    setError(null);
    setErrors({});
  }
  return { isPending, error, errors, justSaved, run, clearErrors };
}

/* ------------------------------------------------------------------ */
/* Clinic                                                              */
/* ------------------------------------------------------------------ */

export function ClinicForm({
  fields,
  initial,
}: {
  fields: FieldDef[];
  initial: {
    clinicName: string;
    timings: string | null;
    address: string | null;
    phone: string | null;
    attributes: Attributes;
  };
}) {
  const [core, setCore] = useState({
    clinicName: initial.clinicName,
    timings: initial.timings ?? "",
    address: initial.address ?? "",
    phone: initial.phone ?? "",
  });
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, justSaved, run, clearErrors } = useSubmit();
  const router = useRouter();

  const dirty = useDirty({ ...core, ...prefixed(attrs.values) });
  useUnsavedWarning(dirty.count > 0);

  const extra = activeFields(fields);
  const sections: NavSection[] = [
    {
      id: "basics",
      label: "Basics",
      filled: Object.values(core).filter(isFilled).length,
      total: 4,
    },
    ...(extra.length > 0
      ? [
          {
            id: "more",
            label: "More about the clinic",
            filled: extra.filter((f) => isFilled(attrs.values[f.key])).length,
            total: extra.length,
          },
        ]
      : []),
  ];

  const name = core.clinicName.trim();
  const facts: PreviewFact[] = [
    {
      question: "What time are you open?",
      answer: core.timings.trim() ? `We're open ${core.timings.trim()}.` : null,
      fallback: "I don't have the clinic timings yet. Let me connect you with reception.",
      fieldId: "timings",
      addLabel: "Add timings",
    },
    {
      question: "Where is the clinic?",
      answer: core.address.trim() ? `We're at ${core.address.trim()}.` : null,
      fallback: "I don't have the address on file. Reception can share directions.",
      fieldId: "address",
      addLabel: "Add address",
    },
    {
      question: "Can I speak to someone at the desk?",
      answer: core.phone.trim() ? `Of course. You can call reception on ${core.phone.trim()}.` : null,
      fallback: "I don't have a reception number to share yet.",
      fieldId: "phone",
      addLabel: "Add reception phone",
    },
    // Up to two clinic-defined facts the agent is allowed to read.
    ...extra
      .filter((f) => f.agentVisible && f.type !== "boolean")
      .slice(0, 2)
      .map((f) => {
        const value = attrs.values[f.key];
        const text = Array.isArray(value) ? value.join(", ") : typeof value === "string" ? value.trim() : "";
        return {
          question: `Can you tell me about ${f.label.toLowerCase()}?`,
          answer: text ? `${f.label}: ${text}.` : null,
          fallback: `I don't have details about ${f.label.toLowerCase()}. Let me connect you with reception.`,
          fieldId: `attr-${f.key}`,
          addLabel: `Add ${f.label.toLowerCase()}`,
        };
      }),
  ];

  function discard() {
    const base = dirty.baseline as typeof core & Record<string, FormValue>;
    setCore({
      clinicName: String(base.clinicName ?? ""),
      timings: String(base.timings ?? ""),
      address: String(base.address ?? ""),
      phone: String(base.phone ?? ""),
    });
    attrs.replace(unprefixed(dirty.baseline));
    clearErrors();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => saveClinicInfo({ core, attributes: attrs.submit() }),
          () => {
            dirty.markSaved();
            toast.success("Clinic details saved", {
              description: "The agent uses them from the next conversation.",
            });
            router.refresh();
          },
        );
      }}
      className="pb-28"
    >
      <div className="grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)_340px]">
        <div className="xl:sticky xl:top-8 xl:self-start">
          <SectionNav sections={sections} />
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <FormCard id="basics" title="Basics" description="The agent reads these to patients, word for word.">
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                id="clinicName"
                label="Clinic name"
                required
                hint="How the agent introduces itself: “Hi, this is Sunrise Health's assistant.”"
                error={errors.clinicName}
              >
                <Input
                  id="clinicName"
                  value={core.clinicName}
                  placeholder="Sunrise Health Clinic"
                  aria-invalid={Boolean(errors.clinicName) || undefined}
                  onChange={(e) => setCore({ ...core, clinicName: e.target.value })}
                />
              </FormField>
              <FormField
                id="phone"
                label="Reception phone"
                hint="Shared when a patient wants to speak to a person."
                error={errors.phone}
              >
                <Input
                  id="phone"
                  type="tel"
                  value={core.phone}
                  placeholder="+91 80 4567 8900"
                  aria-invalid={Boolean(errors.phone) || undefined}
                  onChange={(e) => setCore({ ...core, phone: e.target.value })}
                />
              </FormField>
              <FormField
                id="timings"
                label="Timings"
                hint="Read out as written. Write closed days too, e.g. “Sunday closed”."
                error={errors.timings}
              >
                <Input
                  id="timings"
                  value={core.timings}
                  placeholder="Mon–Sat, 9 AM – 8 PM. Sunday closed."
                  aria-invalid={Boolean(errors.timings) || undefined}
                  onChange={(e) => setCore({ ...core, timings: e.target.value })}
                />
              </FormField>
              <FormField
                id="address"
                label="Address"
                hint="Given to patients asking for directions."
                error={errors.address}
              >
                <Input
                  id="address"
                  value={core.address}
                  placeholder="12, 80 Feet Road, Koramangala, Bengaluru 560034"
                  aria-invalid={Boolean(errors.address) || undefined}
                  onChange={(e) => setCore({ ...core, address: e.target.value })}
                />
              </FormField>
            </div>
          </FormCard>

          {extra.length > 0 && (
            <FormCard
              id="more"
              title="More about the clinic"
              description="Fields your clinic added. The agent only reads the ones tagged “Agent reads this”."
            >
              <AttributeFields
                fields={fields}
                values={attrs.values}
                onChange={attrs.set}
                errors={errors}
                showAgentTag
              />
            </FormCard>
          )}
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <AgentPreview
            greeting={
              name
                ? `Hi, this is ${name}'s assistant. How can I help you today?`
                : "Hi, this is the clinic's assistant. How can I help you today?"
            }
            facts={facts}
          />
        </div>
      </div>

      <StickySaveBar
        dirtyCount={dirty.count}
        pending={isPending}
        justSaved={justSaved}
        error={error}
        label="Save clinic details"
        onDiscard={discard}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Doctors                                                             */
/* ------------------------------------------------------------------ */

export type DoctorFormInitial = {
  id: string | null;
  name: string;
  specialization: string;
  calendarEmail: string;
  isActive: boolean;
  availableDays: Weekday[];
  workingHours: { start: string; end: string };
  consultationDuration: number | null;
  attributes: Attributes;
};

export function DoctorForm({
  fields,
  initial,
}: {
  fields: FieldDef[];
  initial: DoctorFormInitial;
}) {
  const [core, setCore] = useState({
    name: initial.name,
    specialization: initial.specialization,
    calendarEmail: initial.calendarEmail,
    isActive: initial.isActive,
    days: initial.availableDays,
    start: initial.workingHours.start,
    end: initial.workingHours.end,
    duration: initial.consultationDuration === null ? "" : String(initial.consultationDuration),
  });
  const set = <K extends keyof typeof core>(key: K, value: (typeof core)[K]) =>
    setCore((prev) => ({ ...prev, [key]: value }));
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, justSaved, run, clearErrors } = useSubmit();
  const router = useRouter();
  const isNew = !initial.id;

  const dirty = useDirty({ ...core, ...prefixed(attrs.values) });
  useUnsavedWarning(dirty.count > 0);

  const displayName = core.name.trim() ? `Dr. ${core.name.trim()}` : "This doctor";

  function discard() {
    const base = dirty.baseline as typeof core & Record<string, FormValue>;
    setCore({
      name: base.name,
      specialization: base.specialization,
      calendarEmail: base.calendarEmail,
      isActive: base.isActive,
      days: base.days,
      start: base.start,
      end: base.end,
      duration: base.duration,
    });
    attrs.replace(unprefixed(dirty.baseline));
    clearErrors();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const minutes = core.duration.trim() === "" ? null : Number(core.duration);
        run(
          async () => {
            const result = await saveDoctor(initial.id, {
              core: {
                name: core.name,
                specialization: core.specialization,
                calendarEmail: core.calendarEmail,
                isActive: core.isActive,
                availableDays: core.days,
                workingHours: { start: core.start, end: core.end },
                consultationDuration: minutes,
              },
              attributes: attrs.submit(),
            });
            if (result.ok && isNew) {
              router.push(`/doctors/${result.data.id}`);
            }
            return result;
          },
          () => {
            dirty.markSaved();
            toast.success(isNew ? `${displayName} added` : `${displayName} saved`, {
              description: core.isActive
                ? "The agent offers these slots from the next conversation."
                : "Hidden from patients until you mark them active.",
            });
            if (!isNew) router.refresh();
          },
        );
      }}
      className="pb-28"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,720px)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <FormCard
            id="doctor"
            title="Doctor"
            description='The agent offers this doctor by name. Enter the name without "Dr.": the agent adds it.'
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField id="name" label="Name" required error={errors.name}>
                <Input
                  id="name"
                  value={core.name}
                  placeholder="Asha Mehta"
                  aria-invalid={Boolean(errors.name) || undefined}
                  onChange={(e) => set("name", e.target.value)}
                />
              </FormField>
              <FormField
                id="specialization"
                label="Specialization"
                hint="Patients can ask for a doctor by speciality."
                error={errors.specialization}
              >
                <Input
                  id="specialization"
                  value={core.specialization}
                  placeholder="General Physician"
                  onChange={(e) => set("specialization", e.target.value)}
                />
              </FormField>
              <FormField
                id="calendarEmail"
                label="Google Calendar email"
                hint="Bookings are added to this calendar. The doctor must share it with the clinic's calendar service account (Make changes to events). Leave blank to skip."
                error={errors.calendarEmail}
                className="sm:col-span-2"
              >
                <Input
                  id="calendarEmail"
                  type="email"
                  value={core.calendarEmail}
                  placeholder="asha.mehta@gmail.com"
                  aria-invalid={Boolean(errors.calendarEmail) || undefined}
                  onChange={(e) => set("calendarEmail", e.target.value)}
                />
              </FormField>
              <FormField id="isActive" label="Taking bookings" hint="Only active doctors are offered to patients.">
                <div className="flex h-10 items-center gap-2.5">
                  <Switch id="isActive" checked={core.isActive} onCheckedChange={(v) => set("isActive", v)} />
                  <span className="text-ink-2 text-sm">
                    {core.isActive ? "Offered to patients" : "Hidden from patients"}
                  </span>
                </div>
              </FormField>
            </div>
          </FormCard>

          <FormCard
            id="schedule"
            title="Schedule"
            description="The agent offers slots from the start time up to the end time, on these days."
          >
            <div className="flex flex-col gap-5">
              <FormField id="availableDays" label="Working days" required error={errors.availableDays}>
                <div id="availableDays" role="group" className="flex flex-wrap gap-2">
                  {WEEKDAYS.map((day) => (
                    <ToggleChip
                      key={day}
                      pressed={core.days.includes(day)}
                      onPressedChange={(pressed) =>
                        set(
                          "days",
                          pressed
                            ? WEEKDAYS.filter((d) => d === day || core.days.includes(d))
                            : core.days.filter((d) => d !== day),
                        )
                      }
                    >
                      {day.slice(0, 3)}
                    </ToggleChip>
                  ))}
                </div>
              </FormField>
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField id="start" label="Start time" required error={errors["workingHours.start"]}>
                  <Input
                    id="start"
                    type="time"
                    value={core.start}
                    aria-invalid={Boolean(errors["workingHours.start"]) || undefined}
                    onChange={(e) => set("start", e.target.value)}
                  />
                </FormField>
                <FormField id="end" label="End time" required error={errors["workingHours.end"]}>
                  <Input
                    id="end"
                    type="time"
                    value={core.end}
                    aria-invalid={Boolean(errors["workingHours.end"]) || undefined}
                    onChange={(e) => set("end", e.target.value)}
                  />
                </FormField>
                <FormField id="duration" label="Minutes per slot" required error={errors.consultationDuration}>
                  <Input
                    id="duration"
                    type="number"
                    inputMode="numeric"
                    min={5}
                    max={480}
                    step={5}
                    value={core.duration}
                    placeholder="30"
                    aria-invalid={Boolean(errors.consultationDuration) || undefined}
                    onChange={(e) => set("duration", e.target.value)}
                  />
                </FormField>
              </div>
            </div>
          </FormCard>

          {activeFields(fields).length > 0 && (
            <FormCard
              id="profile"
              title="Profile"
              description="Fields your clinic added. The agent only shares the ones tagged “Agent reads this”."
            >
              <AttributeFields
                fields={fields}
                values={attrs.values}
                onChange={attrs.set}
                errors={errors}
                showAgentTag
              />
            </FormCard>
          )}
        </div>

        <div className="xl:sticky xl:top-8 xl:self-start">
          <DoctorPreview
            name={core.name.trim()}
            specialization={core.specialization.trim()}
            days={core.days}
            start={core.start}
            end={core.end}
            duration={core.duration}
            isActive={core.isActive}
            hasCalendar={core.calendarEmail.trim() !== ""}
          />
        </div>
      </div>

      <StickySaveBar
        dirtyCount={dirty.count}
        pending={isPending}
        justSaved={justSaved}
        error={error}
        label={isNew ? "Add doctor" : "Save doctor details"}
        onDiscard={isNew ? undefined : discard}
        alwaysShown={isNew}
        idleText="New doctor, not saved yet"
      />
    </form>
  );
}

/** What the agent will say when offering this doctor, from the live values. */
function DoctorPreview({
  name,
  specialization,
  days,
  start,
  end,
  duration,
  isActive,
  hasCalendar,
}: {
  name: string;
  specialization: string;
  days: Weekday[];
  start: string;
  end: string;
  duration: string;
  isActive: boolean;
  hasCalendar: boolean;
}) {
  const who = name ? `Dr. ${name}` : "this doctor";
  const sentence =
    days.length > 0 && start && end
      ? `I can book you with ${who}${specialization ? ` (${specialization})` : ""} on ${formatDays(days)}, between ${formatTime(start)} and ${formatTime(end)}.${duration ? ` Each appointment is ${duration} minutes.` : ""}`
      : null;

  return (
    <section aria-labelledby="doctor-preview-title" className="bg-surface border-line rounded-xl border p-5">
      <h2 id="doctor-preview-title" className="text-ink text-[17px] leading-6 font-semibold">
        How the agent offers {name ? `Dr. ${name}` : "this doctor"}
      </h2>
      <div className="mt-4 flex items-center gap-3">
        <span
          className={
            isActive
              ? "bg-agent-soft text-agent-text flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
              : "bg-none-soft text-none-text flex size-11 shrink-0 items-center justify-center rounded-xl text-sm font-semibold"
          }
          aria-hidden="true"
        >
          {initialsOf(name || null)}
        </span>
        <div className="min-w-0">
          <p className="text-ink truncate text-sm font-medium">{name ? `Dr. ${name}` : "New doctor"}</p>
          <p className="text-ink-3 truncate text-[13px]">{specialization || "No specialization yet"}</p>
        </div>
      </div>
      <WeekStrip days={days} className="mt-4" />

      <p
        className={
          isActive && sentence
            ? "bg-whatsapp-soft text-whatsapp-text mt-4 rounded-2xl rounded-bl-md px-3 py-2 text-[13px] leading-[18px]"
            : "bg-sunken text-ink-3 mt-4 rounded-2xl rounded-bl-md px-3 py-2 text-[13px] leading-[18px] italic"
        }
      >
        {!isActive
          ? `${name ? `Dr. ${name}` : "This doctor"} isn't offered to patients while hidden.`
          : (sentence ?? "Pick working days and hours so the agent can offer slots.")}
      </p>
      {!hasCalendar && isActive && (
        <p className="text-ink-3 mt-3 text-xs">
          No calendar email: bookings are recorded here but won&apos;t appear on a Google Calendar.
        </p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Patients                                                            */
/* ------------------------------------------------------------------ */

export function PatientForm({
  fields,
  initial,
}: {
  fields: FieldDef[];
  initial: {
    id: string;
    phone: string;
    name: string;
    age: number | null;
    gender: Gender | null;
    attributes: Attributes;
  };
}) {
  const [core, setCore] = useState({
    phone: initial.phone,
    name: initial.name,
    age: initial.age === null ? "" : String(initial.age),
    gender: (initial.gender ?? "") as string,
  });
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, justSaved, run, clearErrors } = useSubmit();
  const router = useRouter();

  const dirty = useDirty({ ...core, ...prefixed(attrs.values) });
  useUnsavedWarning(dirty.count > 0);

  function discard() {
    const base = dirty.baseline as typeof core & Record<string, FormValue>;
    setCore({ phone: base.phone, name: base.name, age: base.age, gender: base.gender });
    attrs.replace(unprefixed(dirty.baseline));
    clearErrors();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            savePatient(initial.id, {
              core: {
                phone: core.phone,
                name: core.name,
                age: core.age.trim() === "" ? null : Number(core.age),
                gender: core.gender === "" ? null : core.gender,
              },
              attributes: attrs.submit(),
            }),
          () => {
            dirty.markSaved();
            toast.success("Patient details saved");
            router.refresh();
          },
        );
      }}
      className="flex max-w-[720px] flex-col gap-6 pb-28"
    >
      <FormCard
        id="patient"
        title="Patient"
        description="The agent fills these in when it books. Phone is how it recognises a returning patient."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField id="name" label="Name" required error={errors.name}>
            <Input
              id="name"
              value={core.name}
              placeholder="Ravi Kumar"
              aria-invalid={Boolean(errors.name) || undefined}
              onChange={(e) => setCore({ ...core, name: e.target.value })}
            />
          </FormField>
          <FormField
            id="phone"
            label="Phone"
            required
            hint="Digits with country code, no +. Example: 919876543210."
            error={errors.phone}
          >
            <Input
              id="phone"
              type="tel"
              inputMode="numeric"
              value={core.phone}
              placeholder="919876543210"
              aria-invalid={Boolean(errors.phone) || undefined}
              onChange={(e) => setCore({ ...core, phone: e.target.value })}
              className="tnum"
            />
          </FormField>
          <FormField id="age" label="Age" error={errors.age}>
            <Input
              id="age"
              type="number"
              inputMode="numeric"
              min={0}
              max={130}
              value={core.age}
              placeholder="42"
              aria-invalid={Boolean(errors.age) || undefined}
              onChange={(e) => setCore({ ...core, age: e.target.value })}
            />
          </FormField>
          <FormField id="gender" label="Gender" error={errors.gender}>
            <NativeSelect id="gender" value={core.gender} onChange={(e) => setCore({ ...core, gender: e.target.value })}>
              <option value="">Not recorded</option>
              {GENDERS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        </div>
      </FormCard>

      {activeFields(fields).length > 0 && (
        <FormCard id="notes" title="Staff notes" description="Staff-only. The agent never reads these.">
          <AttributeFields fields={fields} values={attrs.values} onChange={attrs.set} errors={errors} />
        </FormCard>
      )}

      <StickySaveBar
        dirtyCount={dirty.count}
        pending={isPending}
        justSaved={justSaved}
        error={error}
        label="Save patient details"
        onDiscard={discard}
      />
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Custom-page rows                                                    */
/* ------------------------------------------------------------------ */

export function RecordForm({
  entityType,
  singularLabel,
  fields,
  initial,
  agentEnabled = true,
}: {
  entityType: string;
  singularLabel: string;
  fields: FieldDef[];
  initial: { id: string | null; isActive: boolean; attributes: Attributes };
  /** Whether the agent reads this page at all. */
  agentEnabled?: boolean;
}) {
  const [isActive, setIsActive] = useState(initial.isActive);
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, justSaved, run, clearErrors } = useSubmit();
  const router = useRouter();
  const basePath = `/data/${entityType}`;
  const isNew = !initial.id;
  const noun = singularLabel.toLowerCase();

  const dirty = useDirty({ isActive, ...prefixed(attrs.values) });
  useUnsavedWarning(dirty.count > 0);

  function discard() {
    setIsActive(Boolean(dirty.baseline.isActive));
    attrs.replace(unprefixed(dirty.baseline));
    clearErrors();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(
          async () => {
            const result = await saveRecord(entityType, initial.id, {
              isActive,
              attributes: attrs.submit(),
            });
            if (result.ok && isNew) router.push(`${basePath}/${result.data.id}`);
            return result;
          },
          () => {
            dirty.markSaved();
            toast.success(isNew ? `${singularLabel} added` : `${singularLabel} saved`, {
              description:
                agentEnabled && isActive
                  ? "The agent uses it from the next conversation."
                  : undefined,
            });
            if (!isNew) router.refresh();
          },
        );
      }}
      className="flex max-w-[720px] flex-col gap-6 pb-28"
    >
      <FormCard
        id="details"
        title="Details"
        description={
          agentEnabled
            ? "Fields tagged “Agent reads this” are what the agent tells patients."
            : "The agent doesn't read this page. It's for staff only."
        }
      >
        {activeFields(fields).length === 0 ? (
          <p className="text-ink-3 text-sm">
            This page has no fields yet. An admin can add them in Data settings.
          </p>
        ) : (
          <AttributeFields
            fields={fields}
            values={attrs.values}
            onChange={attrs.set}
            errors={errors}
            showAgentTag={agentEnabled}
          />
        )}
      </FormCard>

      <FormCard id="visibility" title="Visibility">
        <FormField
          id="isActive"
          label="Active"
          hint={`Inactive ${noun} entries are kept but hidden from the agent.`}
        >
          <div className="flex h-10 items-center gap-2.5">
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
            <span className="text-ink-2 text-sm">
              {isActive ? (agentEnabled ? "The agent can use this" : "Active") : "Hidden from the agent"}
            </span>
          </div>
        </FormField>
      </FormCard>

      <StickySaveBar
        dirtyCount={dirty.count}
        pending={isPending}
        justSaved={justSaved}
        error={error}
        label={isNew ? `Add ${noun}` : `Save ${noun}`}
        onDiscard={isNew ? undefined : discard}
        alwaysShown={isNew}
        idleText={`New ${noun}, not saved yet`}
      />
    </form>
  );
}
