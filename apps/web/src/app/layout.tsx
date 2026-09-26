import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Public_Sans, Space_Grotesk } from "next/font/google";
import { Providers } from "./providers";
import "@/styles/globals.css";

/*
 * To skrifter med hver sin opgave. Space Grotesk til overskrifter: en
 * grotesk med tekniske træk og markante bogstavformer — den bærer
 * personligheden uden at forklæde sig som en terminal.
 */
const display = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  weight: ["500", "600", "700"],
});

/* JetBrains Mono bruges kun til data: tal, enheder, nøgler og tastetryk. */
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
  weight: ["400", "500", "700"],
});

const body = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
  display: "swap",
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
