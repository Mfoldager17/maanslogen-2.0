import Link from "next/link";
import type { Gathering } from "@maanslogen/contracts";
import { Badge } from "@/components/ui/badge";
import { ARRANGEMENT_ETIKETTER, STATUS_ETIKETTER, STATUS_TONER } from "@/lib/arrangementer";
import { formatDate } from "@/lib/format";

/**
 * Ét arrangement på listen. Udgivne opslag får en anden markering end dem der
 * stadig er i gang — det er forskellen på "her sker der noget nu" og "det her
 * kan du læse".
 */
export function GatheringCard({ gathering }: { gathering: Gathering }) {
  const udgivet = gathering.publishedAt !== null;

  return (
    <Link
      href={`/arrangementer/${gathering.slug}`}
      className="group block rounded-[var(--radius-card)] border border-line bg-surface p-5 transition-colors hover:border-line-strong"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="neutral">{ARRANGEMENT_ETIKETTER[gathering.kind]}</Badge>
        <Badge tone={STATUS_TONER[gathering.status]}>{STATUS_ETIKETTER[gathering.status]}</Badge>
        {udgivet ? <Badge tone="accent">Opslag</Badge> : null}
      </div>

      <h2 className="mt-3 font-display text-lg font-semibold tracking-tight group-hover:text-accent">
        {gathering.title}
      </h2>

      {gathering.summary ? (
        <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{gathering.summary}</p>
      ) : null}

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-muted">
        {gathering.heldAt ? (
          <div className="flex gap-1.5">
            <dt className="sr-only">Dato</dt>
            <dd>{formatDate(gathering.heldAt)}</dd>
          </div>
        ) : null}
        {gathering.location ? (
          <div className="flex gap-1.5">
            <dt className="sr-only">Sted</dt>
            <dd>{gathering.location}</dd>
          </div>
        ) : null}
        <div className="flex gap-1.5">
          <dt>Ting</dt>
          <dd className="font-semibold text-ink-soft">{gathering.itemCount}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Deltagere</dt>
          <dd className="font-semibold text-ink-soft">{gathering.attendeeCount}</dd>
        </div>
      </dl>
    </Link>
  );
}
