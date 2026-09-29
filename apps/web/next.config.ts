import type { NextConfig } from 'next';

const apiOrigin = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const mediaOrigin = process.env.NEXT_PUBLIC_MEDIA_URL ?? 'http://localhost:9000';

const nextConfig: NextConfig = {
  // Én standalone-artefakt uden node_modules — gør containeren lille.
  output: 'standalone',
  // Kontrakterne kompileres af Next, så der ikke skal bygges et dist-trin først i dev.
  transpilePackages: ['@maanslogen/contracts'],
  images: {
    remotePatterns: [new URL(`${mediaOrigin}/**`), new URL('https://*.r2.dev/**')],
  },
  typedRoutes: true,
  /**
   * Browserens API-kald går til sidens egen vært og bliver sendt videre herfra.
   *
   * Formålet er cookien. Talte browseren direkte med API'et, ville sessionen
   * blive sat host-only på API'ets vært, og sidens server kunne ikke læse den
   * — `middleware.ts` og `lib/api/server.ts` læser cookies fra sidens
   * forespørgsel. Med rewritet kommer `Set-Cookie` tilbage på netop den vært
   * browseren talte med, så hver vært har sin egen session uden en cookie der
   * gælder hele domænet.
   *
   * Der kommer ingen API-logik ind i frontenden af det her. Next videresender
   * forespørgslen uændret; al behandling sker stadig i API'et.
   */
  async rewrites() {
    return [{ source: '/api/v1/:path*', destination: `${apiOrigin}/api/v1/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_API_URL: apiOrigin,
  },
};

export default nextConfig;
