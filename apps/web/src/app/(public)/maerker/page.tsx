import type { Metadata } from "next";
import Link from "next/link";
import { api } from "@/lib/api/api.server";
import { EmptyState } from "@/components/ui/empty-state";
import { formatCountry, formatCount } from "@/lib/format";

export const metadata: Metadata = { title: "Mærker" };
export const revalidate = 900;

export default async function BrandsPage() {
  const page = await api.brands.list({ limit: 100, sort: "name", active: true, withTotal: true });

  if (page.items.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState title="Ingen mærker endnu" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Mærker</h1>
      {/* `items.length` er sidestørrelsen, ikke antallet — med 400 mærker stod der 100. */}
      <p className="mb-8 mt-1 text-sm text-ink-muted">
        {formatCount(page.pageInfo.total ?? page.items.length)}{" "}
        {(page.pageInfo.total ?? page.items.length) === 1 ? "bryggeri" : "bryggerier og huse"}.
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {page.items.map((brand) => (
          <li key={brand.id}>
            <Link
              href={`/katalog?brandIds=${brand.id}`}
              className="flex h-full flex-col gap-1 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 transition-colors hover:border-accent-line hover:bg-accent-soft/40"
            >
              <span className="font-semibold">{brand.name}</span>
              <span className="text-xs text-ink-muted">
                {[
                  formatCountry(brand.countryCode),
                  brand.beverageCount !== undefined
                    ? `${formatCount(brand.beverageCount)} ${brand.beverageCount === 1 ? "drikkevare" : "drikkevarer"}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
