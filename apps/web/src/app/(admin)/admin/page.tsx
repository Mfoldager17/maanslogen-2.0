import Link from "next/link";
import type { Route } from "next";
import { ArrowRight } from "lucide-react";
import { api } from "@/lib/api/api.server";
import { AdminPageHeader } from "@/components/admin/page-header";
import { StarRating } from "@/components/ui/star-rating";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCount, formatRelative } from "@/lib/format";

export default async function AdminDashboard() {
  const [beverages, categories, types, brands, attributes, questions, reviews] = await Promise.all([
    api.beverages.list({ limit: 1, withTotal: true, active: undefined }),
    api.categories.list({ limit: 1, withTotal: true }),
    api.types.list({ limit: 1, withTotal: true }),
    api.brands.list({ limit: 1, withTotal: true }),
    api.attributes.list({ limit: 1, withTotal: true }),
    api.questions.list({ limit: 1, withTotal: true }),
    api.reviews.list({ limit: 5, sort: "createdAt", order: "desc", withTotal: true }),
  ]);

  const stats: { label: string; value: number | null; href: Route }[] = [
    { label: "Drikkevarer", value: beverages.pageInfo.total, href: "/admin/drikkevarer" },
    { label: "Kategorier", value: categories.pageInfo.total, href: "/admin/kategorier" },
    { label: "Typer", value: types.pageInfo.total, href: "/admin/typer" },
    { label: "Mærker", value: brands.pageInfo.total, href: "/admin/maerker" },
    { label: "Attributter", value: attributes.pageInfo.total, href: "/admin/attributter" },
    { label: "Spørgsmål", value: questions.pageInfo.total, href: "/admin/spoergsmaal" },
    { label: "Anmeldelser", value: reviews.pageInfo.total, href: "/admin/anmeldelser" },
  ];

  return (
    <>
      <AdminPageHeader
        title="Overblik"
        description="Katalogets størrelse og de seneste anmeldelser."
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
        {stats.map((stat) => (
          <li key={stat.label}>
            <Link
              href={stat.href}
              className="flex h-full flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 transition-colors hover:border-accent-line"
            >
              <span className="font-display text-2xl font-semibold tabular">
                {stat.value === null ? "—" : formatCount(stat.value)}
              </span>
              <span className="text-xs text-ink-muted">{stat.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 className="font-display text-xl font-semibold">Seneste anmeldelser</h2>
          <Link
            href="/admin/anmeldelser"
            className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
          >
            Se alle
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>

        {/* Uden tom-tilstand stod overskriften og "Se alle" over et tomt hul. */}
        {reviews.items.length === 0 ? (
          <EmptyState
            title="Ingen anmeldelser endnu"
            description="De nyeste dukker op her, så snart nogen har anmeldt."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {reviews.items.map((review) => (
              <li
                key={review.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 text-sm"
              >
                <StarRating value={review.rating} size="sm" showValue={false} />
                <span className="font-semibold">{review.beverageName ?? "Ukendt drikkevare"}</span>
                <span className="text-ink-muted">af {review.author.displayName}</span>
                <span className="ml-auto text-xs text-ink-muted">
                  {formatRelative(review.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
