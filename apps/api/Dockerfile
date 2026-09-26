# syntax=docker/dockerfile:1

# Bygges fra repoets rod:  docker build -f apps/api/Dockerfile .
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- Afhængigheder -------------------------------------------------------
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY apps/api/package.json apps/api/
# Prisma-klienten genereres af postinstall og har brug for schemaet.
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ---- Byg -----------------------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @maanslogen/contracts build && pnpm --filter @maanslogen/api build
# Fjern udviklingsafhængigheder fra det der skal med videre.
RUN pnpm --filter @maanslogen/api --prod deploy /out

# ---- Kørsel --------------------------------------------------------------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Kør ikke som root.
RUN addgroup -S app && adduser -S app -G app

COPY --from=build --chown=app:app /out/node_modules ./node_modules
COPY --from=build --chown=app:app /out/dist ./dist
COPY --from=build --chown=app:app /out/package.json ./
COPY --from=build --chown=app:app /repo/apps/api/prisma ./prisma
COPY --from=build --chown=app:app /repo/apps/api/prisma.config.ts ./

USER app
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=3s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
