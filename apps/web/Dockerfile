# syntax=docker/dockerfile:1

# Bygges fra repoets rod:  docker build -f apps/web/Dockerfile .
#
# Produktionen kører på Cloudflare Workers (apps/web/wrangler.jsonc), ikke som
# container. Imaget her beholdes som udvej, hvis web'en skal køre et andet
# sted, og bygges i CI så det ikke rådner.
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter @maanslogen/web...

FROM deps AS build
COPY . .
# NEXT_PUBLIC_* bages ind i klientbundlen og skal derfor sættes ved build.
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_MEDIA_URL=http://localhost:9000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_MEDIA_URL=$NEXT_PUBLIC_MEDIA_URL
RUN pnpm --filter @maanslogen/contracts build && pnpm --filter @maanslogen/web build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app

# `output: standalone` samler præcis de filer serveren bruger — ingen node_modules.
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
# Ingen `public/`. Appen har ingen statiske filer ved siden af bundlen — ikoner
# er inline SVG, billeder kommer fra R2 — så mappen er tom, og git sporer ikke
# tomme mapper. Lokalt lå den der og buildet gik godt; i et friskt checkout
# fandtes den ikke, og CI faldt på netop denne linje.

USER app
EXPOSE 3000

CMD ["node", "apps/web/server.js"]
