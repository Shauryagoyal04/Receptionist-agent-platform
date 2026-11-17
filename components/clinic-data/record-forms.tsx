"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  FormField,
  FormSection,
  SaveBar,
  ToggleChip,
} from "@/components/clinic-data/form-bits";
import {
  AttributeFields,
  toFormValues,
  toSubmitValues,
  type FormValue,
  type FormValues,
} from "@/components/clinic-data/field-input";
import {
  saveClinicInfo,
  saveDoctor,
  savePatient,
  saveRecord,
} from "@/lib/clinic-data/actions";
import {
  GENDERS,
  WEEKDAYS,
  activeFields,
  type Attributes,
  type FieldDef,
  type Gender,
  type Weekday,
} from "@/lib/clinic-data/model";

/*
 * Create / edit forms for the clinic, doctors, patients and custom-page rows.
 * Core fields are fixed inputs; clinic-defined fields are rendered from the
 * page definition. All four submit JSON to a Server Action, which validates
 * again and returns per-field errors keyed like "workingHours.end" or
 * "attributes.price".
 */

function useAttributeState(fields: FieldDef[], stored: Attributes) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(fields, stored));
  const set = (key: string, value: FormValue) =>
    setValues((prev) => ({ ...prev, [key]: value }));
  return { values, set, submit: () => toSubmitValues(fields, values) };
}

function useSubmit() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  function run(
    action: () => Promise<
      { ok: true } | { ok: false; error: string; fieldErrors?: Record<string, string> }
    >,
    onOk?: () => void,
  ) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setErrors({});
        setSaved(true);
        onOk?.();
      } else {
        setError(result.error);
        setErrors(result.fieldErrors ?? {});
      }
    });
  }
  return { isPending, error, errors, saved, run };
}

function CustomFieldsSection({
  fields,
  title,
  description,
  values,
  onChange,
  errors,
}: {
  fields: FieldDef[];
  title: string;
  description?: string;
  values: FormValues;
  onChange: (key: string, value: FormValue) => void;
  errors: Record<string, string>;
}) {
  if (activeFields(fields).length === 0) return null;
  return (
    <>
      <Separator />
      <FormSection title={title} description={description}>
        <AttributeFields fields={fields} values={values} onChange={onChange} errors={errors} />
      </FormSection>
    </>
  );
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
  const { isPending, error, errors, saved, run } = useSubmit();
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () => saveClinicInfo({ core, attributes: attrs.submit() }),
          () => {
            toast.success("Clinic info saved");
            router.refresh();
          },
        );
      }}
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          <FormSection title="Basics" description="The agent reads these to patients.">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="clinicName" label="Clinic name" required error={errors.clinicName}>
                <Input
                  id="clinicName"
                  value={core.clinicName}
                  aria-invalid={Boolean(errors.clinicName) || undefined}
                  onChange={(e) => setCore({ ...core, clinicName: e.target.value })}
                />
              </FormField>
              <FormField
                id="phone"
                label="Reception phone"
                error={errors.phone}
              >
                <Input
                  id="phone"
                  type="tel"
                  value={core.phone}
                  onChange={(e) => setCore({ ...core, phone: e.target.value })}
                />
              </FormField>
              <FormField
                id="timings"
                label="Timings"
                hint='Read out as written, e.g. "Mon-Sat, 9:00 AM - 5:00 PM".'
                error={errors.timings}
              >
                <Input
                  id="timings"
                  value={core.timings}
                  onChange={(e) => setCore({ ...core, timings: e.target.value })}
                />
              </FormField>
              <FormField id="address" label="Address" error={errors.address}>
                <Input
                  id="address"
                  value={core.address}
                  onChange={(e) => setCore({ ...core, address: e.target.value })}
                />
              </FormField>
            </div>
          </FormSection>

          <CustomFieldsSection
            fields={fields}
            title="More about the clinic"
            values={attrs.values}
            onChange={attrs.set}
            errors={errors}
          />

          <SaveBar pending={isPending} error={error} saved={saved} label="Save clinic info" />
        </CardContent>
      </Card>
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
  const [name, setName] = useState(initial.name);
  const [specialization, setSpecialization] = useState(initial.specialization);
  const [isActive, setIsActive] = useState(initial.isActive);
  const [days, setDays] = useState<Weekday[]>(initial.availableDays);
  const [start, setStart] = useState(initial.workingHours.start);
  const [end, setEnd] = useState(initial.workingHours.end);
  const [duration, setDuration] = useState(
    initial.consultationDuration === null ? "" : String(initial.consultationDuration),
  );
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, saved, run } = useSubmit();
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const minutes = duration.trim() === "" ? null : Number(duration);
        run(
          async () => {
            const result = await saveDoctor(initial.id, {
              core: {
                name,
                specialization,
                isActive,
                availableDays: days,
                workingHours: { start, end },
                consultationDuration: minutes,
              },
              attributes: attrs.submit(),
            });
            if (result.ok && !initial.id) {
              router.push(`/doctors/${result.data.id}`);
            }
            return result;
          },
          () => {
            toast.success(initial.id ? "Doctor saved" : "Doctor added");
            if (initial.id) router.refresh();
          },
        );
      }}
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          <FormSection
            title="Doctor"
            description='Used by the agent for booking. Enter the name without "Dr." — the agent adds it.'
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="name" label="Name" required error={errors.name}>
                <Input
                  id="name"
                  value={name}
                  placeholder="Asha Mehta"
                  aria-invalid={Boolean(errors.name) || undefined}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField id="specialization" label="Specialization" error={errors.specialization}>
                <Input
                  id="specialization"
                  value={specialization}
                  placeholder="General Physician"
                  onChange={(e) => setSpecialization(e.target.value)}
                />
              </FormField>
              <FormField
                id="isActive"
                label="Active"
                hint="Only active doctors are offered to patients."
              >
                <div className="flex h-8 items-center gap-2">
                  <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
                  <span className="text-muted-foreground text-sm">
                    {isActive ? "Taking bookings" : "Hidden from patients"}
                  </span>
                </div>
              </FormField>
            </div>
          </FormSection>

          <Separator />

          <FormSection title="Schedule" description="Slots run from the start time up to the end time.">
            <FormField
              id="availableDays"
              label="Available days"
              required
              error={errors.availableDays}
            >
              <div id="availableDays" role="group" className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((day) => (
                  <ToggleChip
                    key={day}
                    pressed={days.includes(day)}
                    onPressedChange={(pressed) =>
                      setDays(
                        pressed
                          ? WEEKDAYS.filter((d) => d === day || days.includes(d))
                          : days.filter((d) => d !== day),
                      )
                    }
                  >
                    {day.slice(0, 3)}
                  </ToggleChip>
                ))}
              </div>
            </FormField>
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                id="start"
                label="Start time"
                required
                error={errors["workingHours.start"]}
              >
                <Input
                  id="start"
                  type="time"
                  value={start}
                  aria-invalid={Boolean(errors["workingHours.start"]) || undefined}
                  onChange={(e) => setStart(e.target.value)}
                />
              </FormField>
              <FormField id="end" label="End time" required error={errors["workingHours.end"]}>
                <Input
                  id="end"
                  type="time"
                  value={end}
                  aria-invalid={Boolean(errors["workingHours.end"]) || undefined}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </FormField>
              <FormField
                id="duration"
                label="Minutes per slot"
                required
                error={errors.consultationDuration}
              >
                <Input
                  id="duration"
                  type="number"
                  inputMode="numeric"
                  min={5}
                  max={480}
                  step={5}
                  value={duration}
                  aria-invalid={Boolean(errors.consultationDuration) || undefined}
                  onChange={(e) => setDuration(e.target.value)}
                />
              </FormField>
            </div>
          </FormSection>

          <CustomFieldsSection
            fields={fields}
            title="Profile"
            description="Fields your clinic added. Agent-visible ones are shared with patients."
            values={attrs.values}
            onChange={attrs.set}
            errors={errors}
          />

          <SaveBar
            pending={isPending}
            error={error}
            saved={saved && Boolean(initial.id)}
            label={initial.id ? "Save doctor" : "Add doctor"}
          >
            <Button type="button" variant="ghost" asChild>
              <Link href="/doctors">Back to doctors</Link>
            </Button>
          </SaveBar>
        </CardContent>
      </Card>
    </form>
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
  const [phone, setPhone] = useState(initial.phone);
  const [name, setName] = useState(initial.name);
  const [age, setAge] = useState(initial.age === null ? "" : String(initial.age));
  const [gender, setGender] = useState<string>(initial.gender ?? "");
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, saved, run } = useSubmit();
  const router = useRouter();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        run(
          () =>
            savePatient(initial.id, {
              core: {
                phone,
                name,
                age: age.trim() === "" ? null : Number(age),
                gender: gender === "" ? null : gender,
              },
              attributes: attrs.submit(),
            }),
          () => {
            toast.success("Patient saved");
            router.refresh();
          },
        );
      }}
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          <FormSection
            title="Patient"
            description="The agent fills these in when it books. Phone is how it recognises a returning patient."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="name" label="Name" required error={errors.name}>
                <Input
                  id="name"
                  value={name}
                  aria-invalid={Boolean(errors.name) || undefined}
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField
                id="phone"
                label="Phone"
                required
                hint="Digits with country code, no +, e.g. 919876543210."
                error={errors.phone}
              >
                <Input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  aria-invalid={Boolean(errors.phone) || undefined}
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-mono"
                />
              </FormField>
              <FormField id="age" label="Age" error={errors.age}>
                <Input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={130}
                  value={age}
                  aria-invalid={Boolean(errors.age) || undefined}
                  onChange={(e) => setAge(e.target.value)}
                />
              </FormField>
              <FormField id="gender" label="Gender" error={errors.gender}>
                <NativeSelect id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">—</option>
                  {GENDERS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </div>
          </FormSection>

          <CustomFieldsSection
            fields={fields}
            title="Staff notes"
            description="Staff-only. The agent never reads these."
            values={attrs.values}
            onChange={attrs.set}
            errors={errors}
          />

          <SaveBar pending={isPending} error={error} saved={saved} label="Save patient">
            <Button type="button" variant="ghost" asChild>
              <Link href="/patients">Back to patients</Link>
            </Button>
          </SaveBar>
        </CardContent>
      </Card>
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
}: {
  entityType: string;
  singularLabel: string;
  fields: FieldDef[];
  initial: { id: string | null; isActive: boolean; attributes: Attributes };
}) {
  const [isActive, setIsActive] = useState(initial.isActive);
  const attrs = useAttributeState(fields, initial.attributes);
  const { isPending, error, errors, saved, run } = useSubmit();
  const router = useRouter();
  const basePath = `/data/${entityType}`;

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
            if (result.ok && !initial.id) router.push(`${basePath}/${result.data.id}`);
            return result;
          },
          () => {
            toast.success(initial.id ? `${singularLabel} saved` : `${singularLabel} added`);
            if (initial.id) router.refresh();
          },
        );
      }}
    >
      <Card>
        <CardContent className="flex flex-col gap-6">
          {activeFields(fields).length === 0 ? (
            <p className="text-muted-foreground text-sm">
              This page has no fields yet. An admin can add them in Settings → Data.
            </p>
          ) : (
            <AttributeFields
              fields={fields}
              values={attrs.values}
              onChange={attrs.set}
              errors={errors}
            />
          )}

          <Separator />

          <FormField
            id="isActive"
            label="Active"
            hint="Inactive rows are kept but hidden from the agent."
          >
            <div className="flex h-8 items-center gap-2">
              <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-muted-foreground text-sm">
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </FormField>

          <SaveBar
            pending={isPending}
            error={error}
            saved={saved && Boolean(initial.id)}
            label={initial.id ? `Save ${singularLabel.toLowerCase()}` : `Add ${singularLabel.toLowerCase()}`}
          >
            <Button type="button" variant="ghost" asChild>
              <Link href={basePath}>Back to list</Link>
            </Button>
          </SaveBar>
        </CardContent>
      </Card>
    </form>
  );
}
