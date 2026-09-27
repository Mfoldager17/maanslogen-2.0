import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Providers } from "./providers";
import "@/styles/globals.css";

/*
 * Skrifterne ligger i repoet, ikke hos Google.
 *
 * `next/font/google` henter dem over nettet når der bygges, og det gjorde
 * byggeriet afhængigt af at fonts.googleapis.com kan nås fra den maskine der
 * bygger. I CI holdt det ikke: samme commit byggede grønt otte gange og
 * faldt to, altid med samme fejl fra Turbopack —
 *
 *     Module not found: Can't resolve
 *     '@vercel/turbopack-next/internal/font/google/font'
 *
 * Det er ikke en flakey test man kan køre om; det ville ramme en udrulning
 * lige så godt som et PR. Filerne nedenfor er de præcis samme skrifter,
 * hentet én gang fra Google og lagt i `fonts/`. Byggeriet rører ikke nettet
 * længere, og besøgende henter ikke længere noget fra et tredjepartsdomæne.
 *
 * Alle tre er variable i latin-udsnittet (U+0000–00FF, så æ, ø og å er med),
 * tilsammen 87 kB. Ét variabelt snit pr. skrift er mindre end de ni faste
 * vægte, vi brugte før. Se fonts/README.md for hvor de kommer fra, og
 * hvordan de opdateres.
 *
 * Space Grotesk til overskrifter: en grotesk med tekniske træk og markante
 * bogstavformer — den bærer personligheden uden at forklæde sig som en
 * terminal.
 */
const display = localFont({
  src: "./fonts/space-grotesk-latin.woff2",
  variable: "--font-space-grotesk",
  display: "swap",
  // Aksens fulde spænd, ikke de vægte vi bruger i dag. Et variabelt snit
  // indeholder dem alle, og så koster en ny vægt i designet ingenting.
  weight: "300 700",
});

/* JetBrains Mono bruges kun til data: tal, enheder, nøgler og tastetryk. */
const mono = localFont({
  src: "./fonts/jetbrains-mono-latin.woff2",
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: "100 800",
});

const body = localFont({
  src: "./fonts/public-sans-latin.woff2",
  variable: "--font-public-sans",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: {
    default: "Maanslogen — smag, noter og husk",
    template: "%s · Maanslogen",
  },
  description:
    "Anmeld øl, vin og spiritus med de spørgsmål der giver mening for hver kategori. Dynamiske attributter, rigtige smagsprofiler og et katalog man kan filtrere i.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  openGraph: { type: "website", locale: "da_DK", siteName: "Maanslogen" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f5" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c0d" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sætter klassen på <html> før React
    // hydrerer, så serverens markup med vilje ikke matcher.
    <html
      lang="da"
      suppressHydrationWarning
      className={`${display.variable} ${mono.variable} ${body.variable}`}
    >
      <body className="min-h-dvh">
        <a
          href="#indhold"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-[var(--radius-control)] focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-accent"
        >
          Spring til indhold
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
