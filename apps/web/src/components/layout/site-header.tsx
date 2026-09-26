import Link from "next/link";
import type { User } from "@maanslogen/contracts";
import { roleAtLeast } from "@maanslogen/contracts";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { SearchField } from "./search-field";
import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/katalog", label: "Katalog" },
  { href: "/kategorier", label: "Kategorier" },
  { href: "/maerker", label: "Mærker" },
  { href: "/anmeldelser", label: "Anmeldelser" },
] as const;

export function SiteHeader({ user }: { user: User | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:gap-8 sm:px-6">
        <Logo />

        <nav aria-label="Hovedmenu" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <SearchField className="hidden w-56 sm:block lg:w-64" />
          <ThemeToggle />

          {user ? (
            <>
              {roleAtLeast(user.role, "MODERATOR") ? (
                <Button asChild variant="secondary" size="md" className="hidden sm:inline-flex">
                  <Link href="/admin">Admin</Link>
                </Button>
              ) : null}
              <UserMenu user={user} />
            </>
          ) : (
            <Button asChild variant="secondary" size="md">
              <Link href="/log-ind">Log ind</Link>
            </Button>
          )}
        </div>
      </div>

      <nav
        aria-label="Hovedmenu, mobil"
        className="flex gap-5 overflow-x-auto border-t border-line px-4 py-2 md:hidden"
      >
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap text-sm font-medium text-ink-muted"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
