import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The two empty states are deliberately different.
 *
 * "Nothing has come in yet" and "nothing matches these filters" need
 * opposite next steps — one is a setup question, the other is one click away
 * from being solved. Collapsing them into a single "No results" leaves a
 * receptionist stuck on whichever one they are actually in.
 */
export function NoConversationsYet() {
  return (
    <EmptyFrame
      icon={<Inbox className="size-5" />}
      wellClass="bg-agent-soft text-agent"
      title="No conversations yet"
      body="Every WhatsApp chat and phone call the agent handles will show up here as it ends, with the full transcript and what the agent did."
    >
      <Button variant="outline" asChild>
        <Link href="/analytics">See what to set up</Link>
      </Button>
    </EmptyFrame>
  );
}

export function NoMatchingConversations({ summary }: { summary?: string }) {
  return (
    <EmptyFrame
      icon={<SearchX className="size-5" />}
      wellClass="bg-sunken text-ink-3"
      title={summary ? `No conversations match ${summary}` : "No conversations match these filters"}
      body="Try a wider date range or fewer filters. Search matches whole words and phone digits, not partial spellings."
    >
      <Button variant="outline" asChild>
        <Link href="/conversations">Clear filters</Link>
      </Button>
    </EmptyFrame>
  );
}

function EmptyFrame({
  icon,
  wellClass,
  title,
  body,
  children,
}: {
  icon: React.ReactNode;
  wellClass: string;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
      <span className={`flex size-11 items-center justify-center rounded-xl ${wellClass}`}>
        {icon}
      </span>
      <div>
        <p className="text-ink text-[15px] font-semibold">{title}</p>
        <p className="text-ink-3 mx-auto mt-1 max-w-md text-[13px] leading-[18px]">{body}</p>
      </div>
      {children}
    </div>
  );
}
