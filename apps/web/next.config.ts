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
