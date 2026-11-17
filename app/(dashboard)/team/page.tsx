import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { RoleSelect } from "@/components/team/role-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/session";
import { getServerEnv } from "@/lib/env";
import { listTeam, type TeamMember } from "@/lib/data/users";
import { formatInZone } from "@/lib/time";
import { USER_ROLES, USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Team",
  description: "Who can sign in to the console, and what they can see.",
};

export default async function TeamPage() {
  const user = await requireAdmin();
  const { DEFAULT_CLINIC_TIMEZONE: timeZone } = getServerEnv();
  const members = await listTeam(user.clinicId);
  const waiting = members.filter((member) => member.role === "pending").length;

  return (
    <PageShell>
      <PageHeader
        title="Team"
        description={
          waiting > 0
            ? `${waiting} ${waiting === 1 ? "person is" : "people are"} waiting for approval. New accounts see nothing until you give them a role.`
            : "Anyone can sign up. New accounts see nothing until you give them a role here."
        }
      />

      <dl className="text-muted-foreground mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
        {USER_ROLES.map((role) => (
          <div key={role}>
            <dt className="text-foreground inline font-medium">{USER_ROLE_LABELS[role]}:</dt>{" "}
            <dd className="inline">{USER_ROLE_DESCRIPTIONS[role]}</dd>
          </div>
        ))}
      </dl>

      <ul className="mt-5 flex flex-col gap-3">
        {members.map((member) => (
          <li key={member.id}>
            <MemberCard member={member} isYou={member.id === user.id} timeZone={timeZone} />
          </li>
        ))}
      </ul>
    </PageShell>
  );
}

function when(iso: string | null, timeZone: string): string {
  if (!iso) return "never";
  return formatInZone(iso, timeZone, { day: "numeric", month: "short", year: "numeric" });
}

function MemberCard({
  member,
  isYou,
  timeZone,
}: {
  member: TeamMember;
  isYou: boolean;
  timeZone: string;
}) {
  const name = member.displayName || member.email || "Unnamed account";
  return (
    <Card
      className={cn(
        "border-l-2 py-0",
        member.role === "pending" ? "border-l-status-escalated" : "border-l-border",
      )}
    >
      <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">{name}</h2>
            {isYou && <Badge variant="outline">You</Badge>}
            {member.role === "pending" && <Badge variant="outline">Needs approval</Badge>}
          </div>
          {member.email && member.displayName && (
            <p className="text-muted-foreground truncate text-sm">{member.email}</p>
          )}
          <p className="text-muted-foreground mt-1 text-xs">
            Joined {when(member.createdAt, timeZone)} · Last signed in{" "}
            {when(member.lastLoginAt, timeZone)}
          </p>
        </div>

        {isYou ? (
          <p className="text-muted-foreground text-sm">
            {USER_ROLE_LABELS[member.role]}
            <span className="block text-xs">Another admin can change your role.</span>
          </p>
        ) : (
          <RoleSelect userId={member.id} role={member.role} name={name} />
        )}
      </CardContent>
    </Card>
  );
}
