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

`COOKIE_DOMAIN` udelades, og det er med vilje. Men det virker kun fordi
browseren aldrig taler direkte med API'et.

### Hvorfor browserens kald går gennem sitet

En tidligere udgave af det her afsnit påstod at cookien "sættes af API'et og
læses kun af API'et". Det er forkert, og fejlen er værd at kende: både
`middleware.ts` og `lib/api/server.ts` læser sessionen fra **sitets**
forespørgsel, ikke API'ets. Satte API'et cookien host-only på sin egen vært,
ville sitets server aldrig se den — man ville logge ind og blive sendt til
login igen, i ring.

Det ses ikke lokalt, fordi cookies ikke skelner på portnummer:
`localhost:3000` og `localhost:4000` er samme vært.

Derfor kalder browseren `/api/v1/...` på **sitets egen vært**, og
`next.config.ts` sender kaldet videre til API'et serverside. `Set-Cookie`
kommer så tilbage på den vært browseren faktisk talte med, og sitets server kan
læse den. Der kommer ingen API-logik ind i frontenden af det: Next
videresender forespørgslen uændret.

Serverside kald går stadig direkte til API'et. De har ingen oprindelse at være
relative til, og de sender cookien med i hånden.

`samme-oprindelse.test.ts` holder de to ender i sync — et rewrite der ikke
dækker det præfiks browseren kalder, ville ellers give 404 på hvert eneste
API-kald.

### Hvad det betyder for sessioner

Hver vært har sin egen session. Logger man ind på `maanslogen.…`, er man ikke
logget ind på et eventuelt `arrangement-maanslogen.…` — det er to adskilte
cookies, hver host-only på sin vært. For en installeret PWA er det knap nok
mærkbart: man logger ind én gang, og refresh-tokenet lever en måned.

Til gengæld når ingen cookie nogensinde ud over den vært den blev sat på.

### Den dag der er et projekt-domæne

`COOKIE_DOMAIN` er knappen der skifter til delte sessioner. Sat til en fælles
forælder gælder cookien for alle værter under den.

Den er ikke sat til `mathiasfoldager.com` i dag, netop fordi den så også ville
nå alt andet der bor på det domæne. Ligger site og API en dag under
`maanslogen.com`, kan `COOKIE_DOMAIN=maanslogen.com` sættes uden den
indvending — det er én miljøvariabel, ingen kodeændring.

Sættes den, tjekker `env.ts` ved opstart at hver adresse i `CORS_ORIGINS`
ligger under domænet. En cookie for ét domæne når aldrig et site på et andet,
og den fejl viser sig ikke som en fejl, men som en bruger der bliver ved med
at blive sendt til login.

---

## Arrangementernes egen vært

Arrangementerne kan bo på deres eget værtsnavn, fx
`arrangement-maanslogen.mathiasfoldager.com`. Dér er `/` listen og `/{slug}` ét
arrangement, så adressen man deler til en smagning er kort og kun handler om
den.

Det er **ikke** en app til. Samme kode, samme Worker — et værtsnavn er bare en
anden dør ind. `middleware.ts` læser `Host` og skriver stien om; fladen selv
ligger i rutegruppen `(arrangement)`, som hverken har sidehoved eller sidefod.

To ting skal sættes op, og rækkefølgen er ligegyldig:

1. **Custom domain på Workeren.** Cloudflare opretter DNS-recorden i samme
   greb, så der skal ikke noget i Terraform. Det er derfor der heller ikke
   ligger en record til sitet i `dns.tf` i dag.
2. **`NEXT_PUBLIC_ARRANGEMENT_HOST`** sat til det samme navn, med port hvis der
   er en. Den bages ind ved build som de øvrige `NEXT_PUBLIC_*`, så den står i
   `release.yml` og ikke i `wrangler.jsonc`. I GitHub hedder variablen
   `PROD_ARRANGEMENT_HOST`.

Er variablen ikke sat, sker der ingenting: der er kun én vært, og
arrangementerne ligger under `/arrangementer` som hidtil. Sættes den uden at
værtsnavnet peger på Workeren, er det også harmløst — ingen forespørgsler når
frem med det navn i `Host`.

`/log-ind`, `/opret` og `/api` skrives aldrig om. De to første skal findes på
arrangementsværten, fordi **sessionen er host-only pr. vært**: man logger ind
netop dér, og en session på hovedværten gælder ikke på arrangementsværten. For
en flade man installerer på hjemmeskærmen er det knap nok mærkbart — man logger
ind én gang, og refresh-tokenet lever en måned.

Skal de to værter dele session, er det `COOKIE_DOMAIN` der skifter det, og
afsnittet om cookies ovenfor siger hvad det koster.

### Lokalt

```bash
NEXT_PUBLIC_ARRANGEMENT_HOST=arrangement.localhost:3000 pnpm dev
```

Chrome og Firefox sender selv alt under `*.localhost` til 127.0.0.1, så der
skal ikke redigeres i `/etc/hosts`.

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
