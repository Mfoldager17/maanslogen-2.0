import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

const TONES = {
  info: { box: "border-line bg-sunken text-ink-soft", Icon: Info },
  success: { box: "border-positive/30 bg-positive-soft text-positive-ink", Icon: CheckCircle2 },
  warning: { box: "border-warning-ink/25 bg-warning-soft text-warning-ink", Icon: AlertTriangle },
  danger: { box: "border-danger-line bg-danger-soft text-danger", Icon: XCircle },
} as const;

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const { box, Icon } = TONES[tone];

  return (
    <div
      // `alert` annoncerer straks; `status` venter til der er en pause.
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-sm",
        box,
        className,
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 break-words">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}
