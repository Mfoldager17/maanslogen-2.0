"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

/**
 * Et panel der kommer op fra bunden.
 *
 * Den form findes fordi arrangementerne bruges stående, med et glas i den ene
 * hånd. Det man skal røre, skal være nede ved tommelfingeren — ikke midt på
 * en liste man først skal rulle til. Derfor bunden, også på store skærme: én
 * kodevej, og den er den rigtige dér hvor det betyder noget.
 *
 * `max-h-[85dvh]` frem for `vh`: på iOS ændrer den synlige højde sig når
 * adresselinjen glider op og ned, og `vh` regner med den største. Med `vh`
 * ville bunden af panelet — altså knappen — kunne ligge uden for skærmen.
 *
 * `pb-[env(safe-area-inset-bottom)]`: ellers lander knappen under
 * hjemmeindikatoren på en iPhone.
 */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content
          className={
            "fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85dvh] w-full max-w-lg flex-col " +
            "rounded-t-[var(--radius-card)] border border-line bg-surface " +
            "pb-[env(safe-area-inset-bottom)] shadow-[var(--shadow-pop)]"
          }
        >
          {/* Greb. Rent visuelt — det signalerer "den her kommer nedefra". */}
          <div className="flex justify-center pt-2.5">
            <span className="h-1 w-10 rounded-full bg-line-strong" />
          </div>

          <div className="flex items-start gap-3 px-4 pb-3 pt-3">
            <div className="min-w-0 flex-1">
              <Dialog.Title className="font-display text-lg font-semibold tracking-tight">
                {title}
              </Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-sm text-ink-muted">
                  {description}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>

            <Dialog.Close
              className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
              aria-label="Luk"
            >
              <X size={20} />
            </Dialog.Close>
          </div>

          {/* Selve indholdet ruller; hovedet og bunden bliver stående. */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
