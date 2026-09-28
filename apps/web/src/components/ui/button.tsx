import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/cn";

const VARIANTS = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover border border-transparent",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-sunken",
  danger: "bg-surface text-danger border border-danger-line hover:bg-danger-soft",
} as const;

const SIZES = {
  sm: "h-9 px-3 text-sm gap-1.5",
  // 44px: den mindste komfortable berøringsflade.
  md: "h-11 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
} as const;

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
  /** Render som barnet (fx et <Link>) i stedet for et <button>. */
  asChild?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  type,
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return (
    <Component
      // Et <button> uden type submitter en formular ved et uheld.
      {...(asChild ? {} : { type: type ?? "button" })}
      className={cn(
        // `whitespace-nowrap`: knappen har låst højde, så en etiket der brød til
        // to linjer skrev sig ud over sin egen baggrund. `[&_svg]:shrink-0`: et
        // ikon ved siden af tekst blev ellers mast fladt når knappen blev smal.
        "inline-flex items-center justify-center whitespace-nowrap rounded-[var(--radius-control)] font-display font-semibold",
        "[&_svg]:shrink-0",
        "transition-colors duration-150",
        "disabled:cursor-not-allowed disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
