import { cn } from "@/lib/cn";

export interface Column<T> {
  key: string;
  header: string;
  /** Kolonnebredde som Tailwind-klasse; udeladt = fleksibel. */
  width?: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

export function DataTable<T extends { id: string }>({
  columns,
  rows,
  empty,
  caption,
}: {
  columns: Column<T>[];
  rows: T[];
  empty: React.ReactNode;
  caption?: string;
}) {
  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
      <table className="w-full min-w-3xl border-collapse text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr className="border-b border-line bg-sunken">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-xs font-bold uppercase tracking-[0.06em] text-ink-muted",
                  column.align === "right" ? "text-right" : "text-left",
                  column.width,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-line last:border-b-0 hover:bg-sunken/60">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn("px-4 py-3 align-middle", column.align === "right" && "text-right")}
                >
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
