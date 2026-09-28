"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useTransition } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, Star, UserRound } from "lucide-react";
import type { User } from "@maanslogen/contracts";
import { api } from "@/lib/api/api.browser";
import { initialsOf } from "@/lib/format";

export function UserMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  async function logout() {
    await api.auth.logout().catch(() => undefined);
    setOpen(false);
    // refresh() genindlæser server-komponenterne, så headeren opdager
    // at cookien er væk — uden en fuld sideindlæsning.
    startTransition(() => router.refresh());
  }

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger
        className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent"
        aria-label={`Menu for ${user.displayName}`}
      >
        {initialsOf(user.displayName)}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          // `w-56` frem for `min-w-56`: med en minimumsbredde voksede panelet med
          // e-mailens længde, så `truncate` aldrig blev udløst, og ved align="end"
          // kunne det skubbes ud over skærmkanten på en telefon.
          className="z-50 w-56 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-line bg-surface p-1.5 shadow-[var(--shadow-pop)]"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-semibold" title={user.displayName}>
              {user.displayName}
            </p>
            <p className="truncate text-xs text-ink-muted" title={user.email}>
              {user.email}
            </p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />

          <DropdownMenu.Item asChild>
            <Link
              href="/profil"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-sunken"
            >
              <UserRound className="h-4 w-4" aria-hidden="true" />
              Min profil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <Link
              href="/profil/anmeldelser"
              className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-sunken"
            >
              <Star className="h-4 w-4" aria-hidden="true" />
              Mine anmeldelser
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item
            onSelect={(event) => {
              event.preventDefault();
              void logout();
            }}
            disabled={pending}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Log ud
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
