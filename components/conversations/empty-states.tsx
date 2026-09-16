import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * The two empty states are deliberately different.
 *
 * "Nothing has been ingested yet" and "nothing matches these filters" need
 * opposite next steps — one is a setup problem, the other is one click away
 * from being solved. Collapsing them into a single "No results" leaves a
 * receptionist stuck on whichever one they are actually in.
 */
export function NoConversationsYet() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
        <Inbox className="size-5" />
      </span>
      <div>
        <p className="font-medium">No conversations yet</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
          Nothing has reached this clinic so far. Run{" "}
          <code className="bg-muted rounded px-1 py-0.5 font-mono text-xs">
            npm run seed
          </code>{" "}
          to load demo data, or point the agent at the ingestion endpoint.
        </p>
      </div>
    </div>
  );
}

export function NoMatchingConversations() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <span className="bg-muted text-muted-foreground flex size-10 items-center justify-center rounded-md">
        <SearchX className="size-5" />
      </span>
      <div>
        <p className="font-medium">No conversations match these filters</p>
        <p className="text-muted-foreground mx-auto mt-1 max-w-md text-sm">
          Try widening the date range, or clear the filters to start again.
          Search matches whole words and phone digits, not partial spellings.
        </p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/conversations">Clear filters</Link>
      </Button>
    </div>
  );
}
