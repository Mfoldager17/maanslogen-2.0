# Udrulning

> Miljøerne — produktion og det fælles dev-miljø — og hvordan de sættes op:
> [`environments.md`](environments.md). Her står detaljerne om R2, variabler
> og selve imaget.

To containere og to eksterne afhængigheder: PostgreSQL og et S3-kompatibelt
objektlager.

---

## Cloudflare R2

R2 blev valgt frem for et selvhostet objektlager af tre grunde: ingen
egress-omkostninger, CDN uden ekstra opsætning, og en S3-kompatibel API, så
udvikling kan køre mod en lokal S3-server med nøjagtig den samme kode.

### Opsætning

1. **Opret en bucket** i Cloudflare-dashboardet under R2, fx `maanslogen`.

2. **Giv den et offentligt domæne.** Under bucketens _Settings → Public access_
   kan man enten slå R2.dev-underdomænet til (fint til test) eller tilknytte et
   eget domæne som `media-maanslogen.mathiasfoldager.com` (anbefalet — R2.dev
   er rate limited og må ikke bruges i produktion).

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
    "AllowedOrigins": ["https://maanslogen.mathiasfoldager.com"],
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

| Variabel               | Påkrævet       | Note                                                |
| ---------------------- | -------------- | --------------------------------------------------- |
| `NODE_ENV`             |                | `production` slår ekstra tjek til                   |
| `PORT`                 |                | Standard 4000                                       |
| `DATABASE_URL`         | ✔              |                                                     |
| `JWT_ACCESS_SECRET`    | ✔              | Mindst 32 tegn                                      |
| `JWT_REFRESH_SECRET`   | ✔              | Mindst 32 tegn, forskellig fra ovenstående          |
| `ACCESS_TOKEN_TTL`     |                | Standard `15m`                                      |
| `REFRESH_TOKEN_TTL`    |                | Standard `30d`                                      |
| `CORS_ORIGINS`         | ✔ i produktion | Komma-separeret                                     |
| `COOKIE_DOMAIN`        |                | Udelades normalt — se afsnittet om cookies nedenfor |
| `STORAGE_DRIVER`       |                | `r2` eller `s3`                                     |
| `R2_ACCOUNT_ID`        | ✔ ved `r2`     |                                                     |
| `R2_ACCESS_KEY_ID`     | ✔ ved `r2`     |                                                     |
| `R2_SECRET_ACCESS_KEY` | ✔ ved `r2`     |                                                     |
| `R2_BUCKET`            | ✔ ved `r2`     |                                                     |
| `R2_PUBLIC_BASE_URL`   | ✔ ved `r2`     | Fx `https://media-maanslogen.mathiasfoldager.com`   |
| `THROTTLE_LIMIT`       |                | Standard 120 pr. minut                              |
| `ENABLE_SWAGGER`       |                | Sæt `false` for at skjule `/docs`                   |

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
  --build-arg NEXT_PUBLIC_API_URL=https://api-maanslogen.mathiasfoldager.com \
  --build-arg NEXT_PUBLIC_MEDIA_URL=https://media-maanslogen.mathiasfoldager.com \
  -t maanslogen-web .
```

---

## Cookies på tværs af værter

`COOKIE_DOMAIN` **skal** sættes når sitet og API'et bor på hver sit værtsnavn.

Her stod før at cookien "sættes af API'et og læses kun af API'et", og at
host-only derfor var nok. Den præmis er forkert, og det er værd at forstå
hvorfor, for fejlen den fører til ligner ikke en fejl.

Sitet læser cookien selv, på serversiden, før en side overhovedet renderes:

|                                  |                                                      |
| -------------------------------- | ---------------------------------------------------- |
| `apps/web/src/lib/api/server.ts` | henter `cookies()` og sender dem med til API'et      |
| `apps/web/src/middleware.ts`     | læser access-tokenet for at afgøre om ruten må vises |

Begge læser cookies fra **sitets** forespørgsel. En host-only cookie på
`api-maanslogen.mathiasfoldager.com` er ikke med i en forespørgsel til
`maanslogen.mathiasfoldager.com`, så sitet ser den aldrig. Man logger ind,
browseren har sessionen, og sitets server mener stadig man er logget ud —
`/admin` sender til login, og login-siden mener også man er logget ud. En
løkke.

Det ses ikke lokalt. Cookies skelner ikke på portnummer, så `localhost:3000`
og `localhost:4000` er samme vært, og sedlen rækkes over alligevel. Først med
rigtige, forskellige navne falder det fra hinanden.

### Prisen, og hvad der begrænser den

`COOKIE_DOMAIN=mathiasfoldager.com` betyder at cookien når alle underdomæner
under navnet. Det er en reel omkostning ved at ligge på et personligt domæne
frem for et projektdomæne.

Den er afvejet mod at refresh-tokens **roteres ved brug** og hænger i
familier (`auth.service.ts`): bruges et token der allerede er roteret,
spærres hele familien. Et lækket refresh-token spærrer altså sig selv første
gang det bruges ved siden af det rigtige.

Den dag `maanslogen.com` er købt, bliver det `COOKIE_DOMAIN=maanslogen.com`,
og så er hele domænet projektets eget.

### API'et nægter at starte hvis de ikke passer sammen

Ligger et site i `CORS_ORIGINS` uden for `COOKIE_DOMAIN`, kan det site ikke
læse sessionen. Det tjekkes ved opstart (`config/env.ts`) frem for at vise
sig som en login-løkke i drift:

```
COOKIE_DOMAIN: https://maanslogen-web.<navn>.workers.dev ligger uden for
COOKIE_DOMAIN=mathiasfoldager.com. Sitet ville aldrig modtage
sessionscookien og ville sende brugeren til login i en løkke.
```

**Derfor skal custom domain være knyttet til Workeren før prod tages i brug.**

### Dev og staging har ingen session på serversiden

`DEV_COOKIE_DOMAIN` og `STAGING_COOKIE_DOMAIN` står tomme, og det er ikke en
forglemmelse. De to sites ligger på `workers.dev` som preview-aliasser af den
samme Worker, og en cookie for `mathiasfoldager.com` når aldrig derhen.

Følgen: i dev og staging virker indlogget indhold i browseren, men sitets egen
server kender dig ikke. Det samme gælder hvis man kører web lokalt mod
dev-API'et (`apps/web/.env.dev.example`) — `localhost` kan ikke ligge under
domænet.

Det løses den dag de to får navne under domænet; så udfyldes variablerne.

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
