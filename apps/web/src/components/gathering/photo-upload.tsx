"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { uploadGatheringPhoto } from "@/lib/upload";

/**
 * Billeder fra aftenen. Flere ad gangen, fordi man vælger dem i kamerarullen
 * og ikke ét for ét.
 *
 * Uploaderne kører sekventielt med vilje: en telefon på et festivalnet skal
 * ikke sende otte filer samtidig, og fejler nummer fem, er de fire første
 * allerede i hus.
 *
 * `capture` sættes bevidst ikke: så ville knappen åbne kameraet direkte, og
 * det meste af tiden vil man vælge noget man lige har taget.
 */
export function PhotoUpload({
  gatheringId,
  itemId,
  className,
  icon,
}: {
  gatheringId: string;
  itemId?: string;
  className?: string;
  icon?: React.ReactNode;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [igang, setIgang] = useState<{ faerdige: number; ialt: number } | null>(null);

  async function vaelg(files: FileList | null) {
    if (!files || files.length === 0) return;
    const liste = Array.from(files);
    setIgang({ faerdige: 0, ialt: liste.length });

    let fejlede = 0;
    for (const [index, file] of liste.entries()) {
      try {
        await uploadGatheringPhoto(gatheringId, file, itemId ? { itemId } : {});
      } catch (error) {
        fejlede += 1;
        toast.error(
          `Kunne ikke lægge ${file.name} op: ${error instanceof Error ? error.message : "ukendt fejl"}`,
        );
      }
      setIgang({ faerdige: index + 1, ialt: liste.length });
    }

    setIgang(null);
    if (input.current) input.current.value = "";

    const lykkedes = liste.length - fejlede;
    if (lykkedes > 0) {
      toast.success(lykkedes === 1 ? "Billedet er lagt op" : `${lykkedes} billeder er lagt op`);
      router.refresh();
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => void vaelg(event.target.files)}
      />
      <Button
        variant="secondary"
        size="lg"
        disabled={igang !== null}
        onClick={() => input.current?.click()}
        className={cn(className)}
      >
        {icon}
        {igang ? `${igang.faerdige}/${igang.ialt}` : "Billeder"}
      </Button>
    </>
  );
}
