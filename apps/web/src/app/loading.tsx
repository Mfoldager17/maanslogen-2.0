import { GlassLoader } from "@/components/motion/glass-loader";

export default function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <GlassLoader size="lg" label="Skænker op …" />
    </div>
  );
}
