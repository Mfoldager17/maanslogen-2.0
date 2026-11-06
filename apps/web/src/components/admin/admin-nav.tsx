"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import {
  Beer,
  CalendarDays,
  FolderTree,
  HelpCircle,
  Image as ImageIcon,
  ListTree,
  Star,
  Tags,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";

const GROUPS: { title: string; items: { href: Route; label: string; Icon: typeof Beer }[] }[] = [
  {
    title: "Katalog",
    items: [
      { href: "/admin/drikkevarer", label: "Drikkevarer", Icon: Beer },
      { href: "/admin/kategorier", label: "Kategorier", Icon: FolderTree },
      { href: "/admin/typer", label: "Typer", Icon: Tags },
      { href: "/admin/maerker", label: "Mærker", Icon: ImageIcon },
    ],
  },
  {
    title: "Definitioner",
    items: [
      { href: "/admin/attributter", label: "Attributter", Icon: ListTree },
      { href: "/admin/spoergsmaal", label: "Spørgsmål", Icon: HelpCircle },
    ],
  },
  {
    title: "Logen",
    items: [{ href: "/admin/arrangementer", label: "Arrangementer", Icon: CalendarDays }],
  },
  {
    title: "Drift",
    items: [
      { href: "/admin/anmeldelser", label: "Anmeldelser", Icon: Star },
      { href: "/admin/brugere", label: "Brugere", Icon: Users },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Administration" className="flex flex-col gap-5">
      {GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-2.5 pb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted">
            {group.title}
          </p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-10 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-sm transition-colors",
                      active
                        ? "bg-accent-soft font-semibold text-accent-hover"
                        : "text-ink-soft hover:bg-sunken hover:text-ink",
                    )}
                  >
                    <item.Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
