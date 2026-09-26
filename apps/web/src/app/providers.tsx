"use client";

import { useState } from "react";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  // Klienten laves i state, ikke som modul-variabel: ellers ville alle
  // brugere på serveren dele én cache.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (failureCount, error) => {
              // Der er ingen grund til at prøve en 4xx igen.
              const status = (error as { status?: number }).status;
              if (typeof status === "number" && status < 500) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {/* Mørk er standarden — udtrykket er bygget til den. Lys er stadig et valg. */}
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
        {children}
        <Toaster
          position="bottom-right"
          // Uden dette beholder sonner sine egne lyse farver på en mørk flade.
          theme="system"
          toastOptions={{
            classNames: {
              toast:
                "rounded-[var(--radius-control)] border border-line bg-surface font-mono text-sm text-ink shadow-[var(--shadow-pop)]",
              description: "text-ink-muted",
              closeButton: "border-line bg-surface text-ink-muted hover:text-ink",
              icon: "text-accent",
            },
          }}
        />
      </ThemeProvider>
    </QueryClientProvider>
  );
}
