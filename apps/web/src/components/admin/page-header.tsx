import Link from "next/link";
import type { Route } from "next";

export function AdminPageHeader({
  title,
  description,
  breadcrumb,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumb?: { href: Route; label: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {breadcrumb?.length ? (
          <nav aria-label="Brødkrumme" className="mb-1.5 text-sm text-ink-muted">
            {breadcrumb.map((crumb, index) => (
              <span key={crumb.href}>
                {index > 0 ? <span className="mx-1.5">/</span> : null}
                <Link href={crumb.href} className="hover:text-ink">
                  {crumb.label}
                </Link>
              </span>
            ))}
          </nav>
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}
