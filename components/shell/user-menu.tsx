"use client";

import { useTransition } from "react";
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
import { signOutAction } from "@/lib/auth/sign-out-action";
import { USER_ROLE_LABELS, type UserRole } from "@/lib/types";

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
  const [isPending, startTransition] = useTransition();

  const name = displayName ?? email ?? "Signed in";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-sunken flex w-full items-center gap-2.5 rounded-[10px] px-2 py-2 text-left transition-colors duration-(--dur-quick)",
          className,
        )}
      >
        <Avatar name={name} photoURL={photoURL} />
        <span className="min-w-0 flex-1">
          <span className="text-ink block truncate text-sm font-medium">{name}</span>
          <span className="text-ink-3 block truncate text-xs">
            {USER_ROLE_LABELS[role]}
          </span>
        </span>
        <ChevronsUpDown className="text-ink-4 size-3.5 shrink-0" />
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
          disabled={isPending}
          onSelect={(event) => {
            // Keep the menu mounted while the request is in flight so the
            // disabled state is visible rather than the menu vanishing.
            event.preventDefault();
            startTransition(() => signOutAction());
          }}
        >
          <LogOut />
          {isPending ? "Signing out…" : "Sign out"}
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
      // a 28px decoration.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoURL}
        alt=""
        width={28}
        height={28}
        className="size-7 shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-agent-soft text-agent-text flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
    >
      {initialsOf(name)}
    </span>
  );
}
