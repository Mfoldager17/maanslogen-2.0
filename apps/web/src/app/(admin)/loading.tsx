import { GlassLoader } from "@/components/motion/glass-loader";

/**
 * Uden denne fanger `app/loading.tsx` navigationen, og den ligger over
 * `(admin)/admin/layout.tsx` — så hele sidepanelet med navigationen forsvandt
 * ved hvert sideskift og sprang ind igen bagefter.
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center">
      <GlassLoader size="lg" label="Henter …" />
    </div>
  );
}
