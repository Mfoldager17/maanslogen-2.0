"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { dynamicRoute } from "@/lib/routes";

export function AdminPager({ basePath, cursor }: { basePath: string; cursor: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const hasPrevious = params.get("cursor") !== null;
  if (!cursor && !hasPrevious) return null;

  return (
    <div className="mt-4 flex items-center gap-2">
      <p className="text-sm text-ink-muted">
        Cursor-paginering — stabil også når der oprettes nyt undervejs.
      </p>
      <div className="ml-auto flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrevious || pending}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.delete("cursor");
            startTransition(() =>
              router.push(dynamicRoute(`${basePath}${next.size ? `?${next.toString()}` : ""}`)),
            );
          }}
        >
          Til start
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!cursor || pending}
          onClick={() => {
            const next = new URLSearchParams(params.toString());
            next.set("cursor", cursor as string);
            startTransition(() => router.push(dynamicRoute(`${basePath}?${next.toString()}`)));
          }}
        >
          Næste
        </Button>
      </div>
    </div>
  );
}
