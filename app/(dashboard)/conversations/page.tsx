import type { Metadata } from "next";

import { PageHeader, PageShell } from "@/components/page-header";
import { ConversationTable } from "@/components/conversations/conversation-table";
import {
  NoConversationsYet,
  NoMatchingConversations,
} from "@/components/conversations/empty-states";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import {
  EMPTY_FILTERS,
  clinicHasAnyConversations,
  listConversations,
} from "@/lib/data/conversations";

export const metadata: Metadata = {
  title: "Conversations",
  description: "Browse and review what the virtual receptionist handled.",
};

export default async function ConversationsPage() {
  const user = await getCurrentUser();
  // The layout already redirected, but a Server Component must not assume
  // that — it can be rendered for a request the layout did not gate.
  if (!user) return null;

  const [page, anyExist] = await Promise.all([
    listConversations(user.clinicId, EMPTY_FILTERS, null),
    clinicHasAnyConversations(user.clinicId),
  ]);

  return (
    <PageShell>
      <PageHeader
        title="Conversations"
        description="Every call and chat the agent handled, newest first."
      />

      <Card className="mt-6 overflow-hidden py-0">
        {page.conversations.length > 0 ? (
          <ConversationTable
            conversations={page.conversations}
            queryString=""
          />
        ) : anyExist ? (
          <NoMatchingConversations />
        ) : (
          <NoConversationsYet />
        )}
      </Card>
    </PageShell>
  );
}
