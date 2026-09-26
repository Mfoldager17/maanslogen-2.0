import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-ink-muted sm:flex-row sm:items-center sm:px-6">
        <span>© {new Date().getFullYear()} Maanslogen</span>
        <nav aria-label="Sidefod" className="flex gap-5">
          <Link href="/om" className="transition-colors hover:text-ink">
            Om projektet
          </Link>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/docs`}
            className="transition-colors hover:text-ink"
            rel="noreferrer"
          >
            API-dokumentation
          </a>
        </nav>
        <span className="sm:ml-auto">Drik med omtanke.</span>
      </div>
    </footer>
  );
}
