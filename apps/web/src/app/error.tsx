"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-6 text-center">
      <h1 className="font-display text-3xl font-semibold">Noget gik galt</h1>
      <Alert tone="danger" title="Fejlen er logget">
        {error.digest ? `Reference: ${error.digest}` : "Prøv igen om lidt."}
      </Alert>
      <Button onClick={reset}>Prøv igen</Button>
    </main>
  );
}
