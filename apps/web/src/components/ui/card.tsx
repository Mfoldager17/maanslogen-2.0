import { cn } from "@/lib/cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // `min-w-0`: et kort er næsten altid barn af et gitter eller en flexrække,
      // hvor standarden `min-width:auto` lader et langt ubrudt ord presse sporet
      // bredere end skærmen. `break-words` i CardBody bryder ordet, men flytter
      // ikke min-content-bredden — det gør kun dette.
      className={cn(
        "min-w-0 rounded-[var(--radius-card)] border border-line bg-surface",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-line px-5 py-4", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // `break-words`: et langt sammensat dansk ord uden mellemrum skubbede ellers
  // hele siden bredere end skærmen — målt til 131px vandret scroll ved 360px.
  return <div className={cn("min-w-0 break-words px-5 py-4", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("break-words font-display text-lg font-semibold", className)} {...props} />
  );
}
