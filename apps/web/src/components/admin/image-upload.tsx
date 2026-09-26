"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import {
  pickRendition,
  type MediaAsset,
  type MediaAssetInput,
  type MediaOwnerType,
} from "@maanslogen/contracts";
import { uploadImage } from "@/lib/upload";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { GlassLoader } from "@/components/motion/glass-loader";

export function ImageUpload({
  ownerType,
  value,
  onChange,
  existing,
}: {
  ownerType: MediaOwnerType;
  value: MediaAssetInput | null;
  onChange: (value: MediaAssetInput | null) => void;
  /**
   * Et billede der allerede er gemt. Uden det stod redigeringsformularen med
   * den tomme "Vælg et billede"-kasse for en drikkevare der havde et billede,
   * og alt-teksten var blank selvom der var gemt en.
   */
  existing?: MediaAsset | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(
    () => pickRendition(existing, "CARD")?.url ?? null,
  );
  const [alt, setAlt] = useState(existing?.alt ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      setPreview(URL.createObjectURL(file));
      onChange(await uploadImage(file, ownerType, alt));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Uploadet fejlede");
      setPreview(null);
      onChange(null);
    } finally {
      setBusy(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-semibold">Billede</span>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {busy ? (
        <div className="flex h-40 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-line-strong">
          <GlassLoader size="md" label="Skalerer og uploader …" />
        </div>
      ) : preview ? (
        <div className="relative h-40 w-full overflow-hidden rounded-[var(--radius-control)] border border-line">
          {/* Enten en lokal blob-URL eller det gemte billede — i begge tilfælde er der intet for Next at optimere. */}
          <Image src={preview} alt="" fill unoptimized className="object-cover" />
          <button
            type="button"
            onClick={clear}
            aria-label="Fjern billedet"
            className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface/90 text-ink-muted hover:text-danger"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-control)] border border-dashed border-line-strong text-sm text-ink-muted transition-colors hover:border-accent-line hover:bg-accent-soft/30">
          <ImagePlus className="h-6 w-6" aria-hidden="true" />
          Vælg et billede
          <span className="text-xs">JPEG, PNG, WebP eller AVIF · maks 8 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </label>
      )}

      <Field label="Alt-tekst" hint="Beskriv billedet for dem der ikke kan se det.">
        {(props) => (
          <Input
            {...props}
            value={alt}
            onChange={(event) => {
              setAlt(event.target.value);
              if (value) onChange({ ...value, alt: event.target.value.trim() || undefined });
            }}
            placeholder="Mørk flaske med gul etiket"
          />
        )}
      </Field>

      {value ? (
        <Button type="button" variant="secondary" size="sm" onClick={clear} className="self-start">
          Fjern billedet
        </Button>
      ) : null}
    </div>
  );
}
