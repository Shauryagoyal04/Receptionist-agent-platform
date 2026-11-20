import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { ApproveButtons, RoleSelect } from "@/components/team/role-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireAdmin } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { listTeam, type TeamMember } from "@/lib/data/users";
import { formatInZone } from "@/lib/time";
import { USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS } from "@/lib/types";
import { cn, initialsOf } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Team",
  description: "Who can sign in to the console, and what they can see.",
};

export default async function TeamPage() {
  const user = await requireAdmin();
  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();
  const members = await listTeam(user.clinicId);
  const waiting = members.filter((member) => member.role === "pending");
  const active = members.filter((member) => member.role !== "pending");

  return (
    <PageShell>
      <PageHeader
        title="Team"
      />

      <div className="mt-6 flex flex-col gap-6">
        {waiting.length > 0 && (
          <section
            aria-labelledby="waiting-title"
            className="bg-surface border-line overflow-hidden rounded-xl border"
          >
            <header className="bg-agent-soft/50 border-line border-b px-5 py-4">
              <h2 id="waiting-title" className="text-ink text-[17px] leading-6 font-semibold">
                Waiting for approval · <span className="tnum">{waiting.length}</span>
              </h2>
              <p className="text-ink-3 mt-0.5 text-[13px]">
                They signed up and can&apos;t see anything yet. Staff get{" "}
                {USER_ROLE_DESCRIPTIONS.staff.toLowerCase()}; admins get everything.
              </p>
            </header>
            <ul>
              {waiting.map((member) => (
                <li
                  key={member.id}
                  className="border-line flex flex-col gap-3 border-t px-5 py-4 first:border-t-0 sm:flex-row sm:items-center"
                >
                  <Person member={member} isYou={member.id === user.id} />
                  <span className="text-ink-3 text-[13px] sm:ml-auto">
                    Signed up {when(member.createdAt, timeZone)}
                  </span>
                  <ApproveButtons userId={member.id} name={displayName(member)} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          aria-labelledby="members-title"
          className="bg-surface border-line overflow-hidden rounded-xl border"
        >
          <header className="px-5 pt-5 pb-4">
            <h2 id="members-title" className="text-ink text-[17px] leading-6 font-semibold">
              People with access · <span className="tnum">{active.length}</span>
            </h2>
            <dl className="text-ink-3 mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
              {(["admin", "staff"] as const).map((role) => (
                <div key={role}>
                  <dt className="text-ink-2 inline font-medium">{USER_ROLE_LABELS[role]}:</dt>{" "}
                  <dd className="inline">{USER_ROLE_DESCRIPTIONS[role]}</dd>
                </div>
              ))}
            </dl>
          </header>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="hidden md:table-cell">Last signed in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((member) => {
                const isYou = member.id === user.id;
                return (
                  <TableRow key={member.id} className="hover:bg-transparent">
                    <TableCell className="h-16">
                      <Person member={member} isYou={isYou} />
                    </TableCell>
                    <TableCell>
                      {isYou ? (
                        <span className="text-ink-2 text-sm">
                          {USER_ROLE_LABELS[member.role]}
                          <span className="text-ink-3 block text-xs">
                            Another admin can change your role.
                          </span>
                        </span>
                      ) : (
                        <RoleSelect userId={member.id} role={member.role} name={displayName(member)} />
                      )}
                    </TableCell>
                    <TableCell className="text-ink-3 hidden md:table-cell">
                      {when(member.createdAt, timeZone)}
                    </TableCell>
                    <TableCell className="text-ink-3 hidden md:table-cell">
                      {when(member.lastLoginAt, timeZone)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      </div>
    </PageShell>
  );
}

function displayName(member: TeamMember): string {
  return member.displayName || member.email || "Unnamed account";
}

function when(iso: string | null, timeZone: string): string {
  if (!iso) return "Never";
  return formatInZone(iso, timeZone, { day: "numeric", month: "short", year: "numeric" });
}

function Person({ member, isYou }: { member: TeamMember; isYou: boolean }) {
  const name = displayName(member);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          member.role === "pending" ? "bg-sunken text-ink-3" : "bg-agent-soft text-agent-text",
        )}
      >
        {initialsOf(name)}
      </span>
      <div className="min-w-0">
        <p className="text-ink flex items-center gap-2 truncate text-sm font-medium">
          <span className="truncate">{name}</span>
          {isYou && (
            <span className="bg-sunken text-ink-2 inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium">
              You
            </span>
          )}
        </p>
        {member.email && member.displayName && (
          <p className="text-ink-3 truncate text-[13px]">{member.email}</p>
        )}
      </div>
    </div>
  );
}
