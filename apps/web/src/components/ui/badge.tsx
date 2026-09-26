import { cn } from "@/lib/cn";

const TONES = {
  neutral: "bg-sunken text-ink-soft",
  accent: "bg-accent-soft text-accent-hover",
  positive: "bg-positive-soft text-positive-ink",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger",
} as const;

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof TONES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}
