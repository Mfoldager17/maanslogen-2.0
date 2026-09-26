import type { Metadata, Viewport } from "next";
import { Fraunces, Public_Sans } from "next/font/google";
import { Providers } from "./providers";
import "@/styles/globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  weight: ["400", "600", "700"],
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
    { media: "(prefers-color-scheme: light)", color: "#fbf8f3" },
    { media: "(prefers-color-scheme: dark)", color: "#171310" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: next-themes sætter klassen på <html> før React
    // hydrerer, så serverens markup med vilje ikke matcher.
    <html lang="da" suppressHydrationWarning className={`${display.variable} ${body.variable}`}>
      <body className="min-h-dvh">
        <a
          href="#indhold"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-on-accent"
        >
          Spring til indhold
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
