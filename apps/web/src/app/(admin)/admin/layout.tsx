import { redirect } from "next/navigation";
import { roleAtLeast } from "@maanslogen/contracts";
import { getCurrentUser } from "@/lib/session";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";

/**
 * Adgangen håndhæves af API'et; dette lag sørger blot for at ingen bruger
 * spilder tid på en side de alligevel ikke må se.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/log-ind?retur=%2Fadmin");
  if (!roleAtLeast(user.role, "MODERATOR")) redirect("/");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/*
       * `sticky`: uden den gav `h-dvh` en spalte der var præcis én skærm høj,
       * så den hvide flade og skillelinjen stoppede midt nede på en lang liste.
       */}
      <aside className="flex shrink-0 flex-col gap-6 border-b border-line bg-surface px-4 py-5 lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2">
          <Logo href="/" />
          <Badge tone="accent">Admin</Badge>
        </div>

        <AdminNav />

        <div className="mt-auto flex items-center gap-2 rounded-[var(--radius-control)] bg-sunken p-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-ink-muted">{user.role}</p>
          </div>
          <ThemeToggle />
        </div>
      </aside>

      <main id="indhold" className="min-w-0 flex-1 px-4 py-6 sm:px-8">
        {children}
      </main>
    </div>
  );
}
