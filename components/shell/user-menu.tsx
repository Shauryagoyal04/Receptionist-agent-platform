"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronsUpDown, LogOut } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn, initialsOf } from "@/lib/utils";
import { signOutEverywhere } from "@/lib/auth/client-actions";
import type { UserRole } from "@/lib/types";

export function UserMenu({
  displayName,
  email,
  photoURL,
  role,
  className,
  align = "start",
}: {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  role: UserRole;
  className?: string;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();

  const name = displayName ?? email ?? "Signed in";

  async function onSignOut() {
    setBusy(true);
    try {
      await signOutEverywhere();
      startTransition(() => {
        router.replace("/login");
        router.refresh();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-sidebar-accent/60 flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
          className,
        )}
      >
        <Avatar name={name} photoURL={photoURL} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{name}</span>
          <span className="text-muted-foreground block truncate text-xs capitalize">
            {role}
          </span>
        </span>
        <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="w-56">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate font-medium">{name}</span>
          {email && (
            <span className="text-muted-foreground truncate text-xs font-normal">
              {email}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={busy || isPending}
          onSelect={(event) => {
            // Keep the menu mounted while the request is in flight so the
            // disabled state is visible rather than the menu vanishing.
            event.preventDefault();
            void onSignOut();
          }}
        >
          <LogOut />
          {busy || isPending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Avatar({
  name,
  photoURL,
}: {
  name: string;
  photoURL: string | null;
}) {
  if (photoURL) {
    return (
      // A plain <img>: these are arbitrary Google avatar URLs, and adding every
      // possible host to next.config images.remotePatterns is not worth it for
      // a 24px decoration.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt=""
        width={24}
        height={24}
        className="size-6 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-accent text-accent-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
    >
      {initialsOf(name)}
    </span>
  );
}
