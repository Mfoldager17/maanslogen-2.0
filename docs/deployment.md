# Udrulning

To containere og to eksterne afhængigheder: PostgreSQL og et S3-kompatibelt
objektlager.

---

## Cloudflare R2

R2 blev valgt frem for selvhostet MinIO af tre grunde: ingen egress-omkostninger,
CDN uden ekstra opsætning, og en S3-kompatibel API, så udvikling kan køre på
MinIO med nøjagtig den samme kode.

### Opsætning

1. **Opret en bucket** i Cloudflare-dashboardet under R2, fx `maanslogen`.

2. **Giv den et offentligt domæne.** Under bucketens _Settings → Public access_
   kan man enten slå R2.dev-underdomænet til (fint til test) eller tilknytte et
   eget domæne som `cdn.maanslogen.dk` (anbefalet — R2.dev er rate limited og må
   ikke bruges i produktion).

3. **Lav en API-token** under _R2 → Manage API Tokens_ med adgangen
   _Object Read & Write_ begrænset til den ene bucket. Du får en Access Key ID og
   en Secret Access Key.

4. **Find dit Account ID** — det står i R2-oversigten og indgår i endpointet:
   `https://<account-id>.r2.cloudflarestorage.com`.

5. **Sæt miljøvariablerne** (se nedenfor).

### CORS

Browseren uploader direkte til R2 med presignede URL'er, så bucketen skal tillade
`PUT` fra sitets oprindelse. Under bucketens _Settings → CORS Policy_:

```json
[
  {
    "AllowedOrigins": ["https://maanslogen.dk"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "MaxAgeSeconds": 3600
  }
]
```

Uden dette fejler uploads i browseren, mens API'et ser helt sundt ud.

### Caching

Den vigtigste indstilling for regningen er en Cache Rule foran bucketen: et
cache-hit på Cloudflares kant er ikke en R2-operation. Se
[`r2-omkostninger.md`](r2-omkostninger.md) for den konkrete opsætning og
regnestykket bag.

### Livscyklusregel (anbefalet)

API'et rydder selv uafhentede uploads op hver time, men en livscyklusregel i R2 er
et billigt sikkerhedsnet, hvis en oprydning nogensinde ikke kører. Sæt den til at
slette ufuldendte multipart-uploads efter et døgn.

---

## Miljøvariabler

Konfigurationen valideres ved opstart. Mangler eller er noget forkert, starter
processen **ikke** — i stedet for at fejle først når nogen rammer det endpoint der
manglede en nøgle.

### API (`apps/api`)

| Variabel               | Påkrævet       | Note                                                             |
| ---------------------- | -------------- | ---------------------------------------------------------------- |
| `NODE_ENV`             |                | `production` slår ekstra tjek til                                |
| `PORT`                 |                | Standard 4000                                                    |
| `DATABASE_URL`         | ✔              |                                                                  |
| `JWT_ACCESS_SECRET`    | ✔              | Mindst 32 tegn                                                   |
| `JWT_REFRESH_SECRET`   | ✔              | Mindst 32 tegn, forskellig fra ovenstående                       |
| `ACCESS_TOKEN_TTL`     |                | Standard `15m`                                                   |
| `REFRESH_TOKEN_TTL`    |                | Standard `30d`                                                   |
| `CORS_ORIGINS`         | ✔ i produktion | Komma-separeret                                                  |
| `COOKIE_DOMAIN`        |                | Fx `.maanslogen.dk`, hvis API og site er på hver sit underdomæne |
| `STORAGE_DRIVER`       |                | `r2` eller `s3`                                                  |
| `R2_ACCOUNT_ID`        | ✔ ved `r2`     |                                                                  |
| `R2_ACCESS_KEY_ID`     | ✔ ved `r2`     |                                                                  |
| `R2_SECRET_ACCESS_KEY` | ✔ ved `r2`     |                                                                  |
| `R2_BUCKET`            | ✔ ved `r2`     |                                                                  |
| `R2_PUBLIC_BASE_URL`   | ✔ ved `r2`     | Fx `https://cdn.maanslogen.dk`                                   |
| `THROTTLE_LIMIT`       |                | Standard 120 pr. minut                                           |
| `ENABLE_SWAGGER`       |                | Sæt `false` for at skjule `/docs`                                |

Generér hemmeligheder med:

```bash
openssl rand -base64 48
```

I produktion afvises hemmeligheder der stadig indeholder udviklingsværdier, og
`CORS_ORIGINS` skal sættes eksplicit.

### Web (`apps/web`)

| Variabel                | Note                                                      |
| ----------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_API_URL`   | API'ets oprindelse. **Bages ind ved build**               |
| `NEXT_PUBLIC_MEDIA_URL` | R2-domænet — skal med i `next.config.ts`' billedhvidliste |
| `NEXT_PUBLIC_SITE_URL`  | Bruges til absolutte URL'er i metadata                    |

Fordi `NEXT_PUBLIC_*` bages ind i klientbundlen, skal de sættes ved **build**, ikke
ved kørsel:

```bash
docker build -f apps/web/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=https://api.maanslogen.dk \
  --build-arg NEXT_PUBLIC_MEDIA_URL=https://cdn.maanslogen.dk \
  -t maanslogen-web .
```

---

## Cookies på tværs af underdomæner

Kører API og site på hver sit underdomæne (`api.maanslogen.dk` og
`maanslogen.dk`), skal `COOKIE_DOMAIN=.maanslogen.dk` sættes, så cookien
deles. I produktion sættes de automatisk med `Secure` og `SameSite=None`, hvilket
kræver HTTPS begge steder.

Kører begge bag samme domæne (fx `/api` via en reverse proxy), kan
`COOKIE_DOMAIN` udelades.

---

## Migreringer

```bash
# Fra repoet
pnpm --filter @maanslogen/api db:deploy

# Fra imaget. Binæren kaldes direkte: imaget indeholder ikke et pnpm-workspace,
# og `pnpm exec` ville få corepack til at hente en pnpm der ikke passer.
docker run --rm -e DATABASE_URL="$DATABASE_URL" maanslogen-api \
  ./node_modules/.bin/prisma migrate deploy
```

`prisma migrate deploy` er den kommando der hører til produktion — den
genererer ikke nye migreringer og stiller ingen spørgsmål. Kør den som et
separat trin før den nye version starter, ikke fra containerens entrypoint:
ellers kapløber flere instanser om at migrere samtidig.

Bemærk at Prisma 7 har flyttet forbindelses-URL'en ud af `schema.prisma` og ind i
`prisma.config.ts`, hvor den læses fra `DATABASE_URL`.

---

## Health checks

| Sti                    | Til                              |
| ---------------------- | -------------------------------- |
| `/api/v1/health/live`  | Liveness — svarer processen?     |
| `/api/v1/health/ready` | Readiness — kan vi nå databasen? |

Brug `live` til genstart og `ready` til at afgøre om instansen skal have trafik.
En instans der ikke kan nå databasen, skal tages ud af rotation, ikke genstartes.

---

## Første bruger

Seeden opretter en admin, men den hører til udvikling. I produktion opretter du
den første konto via `POST /api/v1/auth/register` (den får rollen `USER`) og
hæver rollen direkte i databasen:

```sql
UPDATE users SET role = 'ADMIN' WHERE email = 'dig@example.dk';
```

Der findes med vilje ingen vej til at tildele sig selv en rolle gennem API'et.
Derefter kan resten administreres fra `/admin/brugere`.

---

## Driftsnoter

- **Logning** er struktureret JSON i produktion (pino) med `requestId` på hver
  linje, så en fejl i frontend kan spores til den præcise forespørgsel.
  Authorization-headere, cookies og adgangskoder fjernes før logning.
- **Cron-jobs** kører i API-processen: uafhentede uploads ryddes hver time,
  udløbne refresh-tokens hver nat kl. 3. Kører man flere instanser, vil de alle
  køre jobbene — det er harmløst her, da begge operationer er idempotente, men det
  er værd at vide.
- **Rate limiting** er per instans og per IP. Bag en load balancer skal
  `X-Forwarded-For` være til at stole på; Fastify er sat op med `trustProxy`.
