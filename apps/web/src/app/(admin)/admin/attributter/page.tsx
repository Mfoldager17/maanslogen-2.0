import Link from "next/link";
import { Filter, Plus, Star } from "lucide-react";
import { api } from "@/lib/api/api.server";
import { alleSider } from "@/lib/api/alle-sider";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const TYPE_LABELS: Record<string, string> = {
  TEXT: "Tekst",
  NUMBER: "Tal",
  BOOLEAN: "Ja/nej",
  ENUM: "Ét valg",
  MULTI_ENUM: "Flere valg",
};

export default async function AdminAttributesPage() {
  const [definitions, categories] = await Promise.all([
    api.attributes.list({ limit: 100, sort: "sortOrder" }),
    alleSider(api.categories.list, { sort: "sortOrder" }),
  ]);

  const categoryName = new Map(categories.map((category) => [category.id, category.name]));

  return (
    <>
      <AdminPageHeader
        title="Attributter"
        description="Definerer hvilke egenskaber en drikkevare kan have — uden en eneste datamigrering."
        breadcrumb={[{ href: "/admin", label: "Overblik" }]}
        actions={
          <Button asChild>
            <Link href="/admin/attributter/ny">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Ny attribut
            </Link>
          </Button>
        }
      />

      {definitions.items.length === 0 ? (
        <EmptyState
          title="Ingen attributter endnu"
          description="Opret fx alkoholprocent, så drikkevarerne får deres første egenskab."
          action={
            <Button asChild>
              <Link href="/admin/attributter/ny">Opret den første</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {definitions.items.map((definition) => (
            <li key={definition.id}>
              <Link
                href={`/admin/attributter/${definition.id}`}
                className="flex h-full flex-col gap-2 rounded-[var(--radius-card)] border border-line bg-surface px-5 py-4 transition-colors hover:border-accent-line"
              >
                <div className="flex items-start gap-2">
                  <span
                    className="min-w-0 flex-1 truncate font-semibold"
                    title={definition.displayName}
                  >
                    {definition.displayName}
                  </span>
                  {definition.filterable ? (
                    <Filter className="h-3.5 w-3.5 shrink-0 text-accent" aria-label="Filtrerbar" />
                  ) : null}
                  {definition.highlighted ? (
                    <Star className="h-3.5 w-3.5 shrink-0 text-star" aria-label="Fremhævet" />
                  ) : null}
                </div>

                {/* Nøglen er låst for evigt — man skal kunne læse hele. */}
                <code className="block truncate text-xs text-ink-muted" title={definition.key}>
                  {definition.key}
                </code>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
                  <Badge>{TYPE_LABELS[definition.dataType] ?? definition.dataType}</Badge>
                  {definition.unit ? <Badge>{definition.unit}</Badge> : null}
                  {definition.required ? <Badge tone="accent">Påkrævet</Badge> : null}
                </div>

                {/* En lang kommaliste trak ellers hele gitterrækken i højden. */}
                <p
                  className="line-clamp-2 text-xs text-ink-muted"
                  title={
                    definition.categoryIds.length === 0
                      ? "Alle kategorier"
                      : definition.categoryIds.map((id) => categoryName.get(id) ?? "?").join(", ")
                  }
                >
                  {definition.categoryIds.length === 0
                    ? "Alle kategorier"
                    : definition.categoryIds.map((id) => categoryName.get(id) ?? "?").join(", ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
