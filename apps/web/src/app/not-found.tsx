import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SippingGlass } from "@/components/motion/sipping-glass";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <SippingGlass className="h-16 w-16" />
      <h1 className="font-display text-3xl font-semibold">Den fandtes ikke</h1>
      <p className="text-ink-muted">
        Siden er enten flyttet, eller også har nogen drukket den. Prøv kataloget.
      </p>
      <Button asChild>
        <Link href="/katalog">Til kataloget</Link>
      </Button>
    </main>
  );
}
