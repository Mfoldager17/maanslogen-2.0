"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dynamicRoute } from "@/lib/routes";

/**
 * Cursor-paginering: næste side hentes ved at sende den cursor API'et gav os
 * tilbage. Ingen sidetal, og ingen risiko for at se samme række to gange,
 * fordi nogen har oprettet noget imens.
 */
export function LoadMore({ cursor }: { cursor: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  if (!cursor) return null;

  function loadMore() {
    const next = new URLSearchParams(params.toString());
    next.set("cursor", cursor as string);
    startTransition(() =>
      router.push(dynamicRoute(`/katalog?${next.toString()}`), { scroll: false }),
    );
  }

  return (
    <div className="flex justify-center pt-8">
      <Button variant="secondary" size="lg" onClick={loadMore} disabled={pending}>
        {pending ? "Henter …" : "Vis flere"}
      </Button>
    </div>
  );
}
