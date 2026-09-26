import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { api } from "@/lib/api/api.server";
import { ReviewList } from "@/components/catalog/review-list";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Min profil" };

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/log-ind?retur=%2Fprofil");

  const reviews = await api.reviews.list({
    userId: user.id,
    limit: 10,
    sort: "createdAt",
    order: "desc",
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <h1 className="font-display text-3xl font-semibold tracking-tight">{user.displayName}</h1>
          {user.role !== "USER" ? <Badge tone="accent">{user.role}</Badge> : null}
        </div>
        <p className="text-sm text-ink-muted">
          {user.email} · medlem siden {formatDate(user.createdAt)}
        </p>
      </header>

      <h2 className="mb-4 font-display text-xl font-semibold">Dine anmeldelser</h2>
      <ReviewList reviews={reviews.items} />
    </div>
  );
}
