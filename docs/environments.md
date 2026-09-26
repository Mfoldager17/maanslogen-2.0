# Miljøer

To miljøer. **Produktion** kører altid. **Dev** findes kun så længe der er et
åbent PR — eller så længe du selv har noget kørende lokalt.

```
                 ┌─────────────────────────────┐
  maanslogen.dk  │  Worker (web)               │
                 └──────────────┬──────────────┘
                                │  fetch
                 ┌──────────────▼──────────────┐
 api.maanslogen. │  Cloudflare Tunnel → Pi'en  │
 dk              │  Caddy → api → postgres     │
                 └─────────────────────────────┘

  PR #42 åbnes
                 ┌─────────────────────────────┐
 pr-42-…workers. │  Worker-version (web)       │
 dev             └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
 api-pr-42.dev.  │  Samme tunnel, samme Caddy  │
 maanslogen.dk   │  → container pr. PR         │
                 └──────────────┬──────────────┘
                                │
                 ┌──────────────▼──────────────┐
                 │  maanslogen_dev — fælles     │
                 │  testdata, deles med lokal   │
                 └─────────────────────────────┘
```

|          | Produktion              | Dev                                 |
| -------- | ----------------------- | ----------------------------------- |
| Web      | Worker `maanslogen-web` | Worker-**version** pr. PR, egen URL |
| API      | Container på Pi'en      | Container pr. PR + ét delt dev-API  |
| Database | `maanslogen`            | `maanslogen_dev` — **én, fælles**   |
| Billeder | `maanslogen-media`      | `maanslogen-media-dev`              |
| Lever    | Altid                   | Mens PR'et er åbent                 |

---

## Hvorfor sådan her

**Web på Workers.** Next 16 kører på Workers gennem
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Bundlen er
1,5 MB gzippet mod gratisplanens 3 MB, og gratisplanen giver 100.000
forespørgsler om dagen. Previews bruger `wrangler versions upload`, som
lægger en version op med sin egen URL **uden** at røre den der er udrullet.
Derfor er der ingen Worker at rydde op i bagefter.

**API på Pi'en.** Du spurgte om der fandtes et gratis alternativ. Kort svar:
ikke et der er bedre end Pi'en.

|                       | Hvad der er hagen                                                    |
| --------------------- | -------------------------------------------------------------------- |
| Render free           | Sover efter 15 minutter. Første besøgende venter ~50 sekunder.       |
| Fly.io                | Ikke længere rigtig gratis — pay-as-you-go med et månedligt minimum. |
| Cloudflare Containers | Kræver Workers Paid, fra 5 $/md.                                     |
| Koyeb free            | Én tjeneste, og så er der ikke plads til previews.                   |
| Oracle Always Free    | Reelt gratis og stærk nok, men tilmelding og kapacitet driller.      |

Og uanset hvad skal databasen ligge et sted med vedvarende lagring. Når
Postgres alligevel skal køre på Pi'en, koster API'et ved siden af ingenting.
Så: Pi'en, og Cloudflare Tunnel foran. Ingen port åbnes i routeren, der skal
ikke være en fast IP-adresse, og Pi'ens adresse bliver aldrig offentlig.

Skal det senere flyttes, er det kun `infra/pi/` der skal skiftes ud —
imaget er det samme, og web'en kender kun et værtsnavn.

**Én dev-database.** Previews og lokal udvikling deler `maanslogen_dev`.
Det er enklere end en database pr. PR, og det er det du bad om. Konsekvensen
står nedenfor, og den er værd at kende.

---

## Sæt det op

Én gang. Regn med en times tid.

### 1. Cloudflare

Opret et API-token under _My Profile → API Tokens_ med **Edit** på: Zone DNS,
Workers R2 Storage, Zone Cache Rules og Cloudflare Tunnel.

Opret bucketen `maanslogen-tfstate` i hånden — Terraforms tilstand skal ligge
et sted, og den kan ikke oprette sin egen bucket. Lav en R2 API-nøgle under
_R2 → Manage API tokens_.

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars    # account_id, zone_id, domain
export CLOUDFLARE_API_TOKEN=...
export AWS_ACCESS_KEY_ID=...                    # R2-nøglen
export AWS_SECRET_ACCESS_KEY=...

terraform init -backend-config="endpoints={s3=\"https://<account-id>.r2.cloudflarestorage.com\"}"
terraform plan        # læs den. Koden er ikke kørt mod Cloudflare — se infra/terraform/README.md
terraform apply
```

Bagefter, i hånden i dashboardet:

- **Tunnelens ingress**: én regel, alt videre til `http://caddy:8080`.
- **R2 → hver bucket → Settings → Public access → Custom domains**: knyt
  `media.maanslogen.dk` til prod-bucketen og `media.dev.maanslogen.dk` til
  dev-bucketen.
- **Caching → Tiered Cache**: slå Smart Tiered Caching til. Gratis, og det
  skærer i Class B-operationerne. Se [`r2-omkostninger.md`](r2-omkostninger.md).

### 2. Pi'en

```bash
git clone https://github.com/Mfoldager17/maanslogen-2.0 ~/maanslogen

# Hemmelighederne ligger ét fast sted uden for ethvert checkout. Grunden er
# GitHub-runneren: den tjekker repoet ud i sit eget arbejdsbibliotek, og .env
# er git-ignoreret, så der ville filen aldrig være.
sudo mkdir -p /etc/maanslogen
sudo cp ~/maanslogen/infra/pi/.env.example /etc/maanslogen/pi.env
sudo chown "$USER" /etc/maanslogen/pi.env
sudo chmod 600 /etc/maanslogen/pi.env
```

Udfyld `/etc/maanslogen/pi.env`. Hemmelighederne genereres med `openssl rand -base64 48`. Prod
og dev skal have **hvert sit** sæt JWT-nøgler, så et token fra et preview ikke
virker i produktion. `CLOUDFLARE_TUNNEL_TOKEN` kommer fra
`terraform output -raw tunnel_token`.

```bash
cd ~/maanslogen/infra/pi
docker compose --env-file /etc/maanslogen/pi.env up -d
```

Scripts og workflows finder selv filen: `MAANSLOGEN_ENV_FILE` hvis den er sat,
ellers `/etc/maanslogen/pi.env`, ellers en `.env` ved siden af
`docker-compose.yml`. Findes ingen af dem, siger de fra med det samme frem for
at køre videre med tomme variabler.

Første gang oprettes begge databaser. Byg imaget og få skema og testdata på
plads:

```bash
cd ~/maanslogen
docker build -f apps/api/Dockerfile -t maanslogen-api:latest .
docker tag maanslogen-api:latest maanslogen-api:dev

. infra/pi/load-env.sh

# Produktionen migreres med den rolle der ejer den.
docker run --rm --network maanslogen \
  -e DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/maanslogen?schema=public" \
  maanslogen-api:latest ./node_modules/.bin/prisma migrate deploy

# Dev har sin egen rolle, som ikke kan forbinde til produktionen.
dev_url="postgresql://maanslogen_dev:$DEV_POSTGRES_PASSWORD@postgres:5432/maanslogen_dev?schema=public"
docker run --rm --network maanslogen -e DATABASE_URL="$dev_url" \
  maanslogen-api:dev ./node_modules/.bin/prisma migrate deploy

# Kun dev får testdata. Produktionen starter tom.
docker run --rm --network maanslogen -e DATABASE_URL="$dev_url" \
  maanslogen-api:dev ./node_modules/.bin/prisma db seed
```

### 3. GitHub-runneren på Pi'en

Workflows skal kunne starte containere på Pi'en. En selvhostet runner henter
selv sit arbejde, så der skal ikke åbnes noget indad.

_Settings → Actions → Runners → New self-hosted runner_, følg trinnene, og giv
den labels `self-hosted` og **`maanslogen-pi`** — workflowsene beder om netop
den. Installér den som tjeneste med `./svc.sh install && ./svc.sh start`, så
den overlever en genstart.

> **Vigtigt, fordi repoet er offentligt.** En selvhostet runner kører
> workflow-kode på din maskine derhjemme, og alle kan forke et offentligt repo
> og åbne et PR. GitHub fraråder direkte den kombination.
>
> Derfor står der på både `api`- og `web`-jobbet i `preview.yml`:
>
> ```yaml
> if: github.event.pull_request.head.repo.full_name == github.repository
> ```
>
> Det er sandt kun når grenen ligger i repoet selv, hvilket kræver
> push-adgang; en fork har et andet navn, og GitHub afviser jobbet før der
> tildeles en runner. **Fjern ikke de to linjer** — de er det eneste der står
> mellem en fremmed og Pi'en.
>
> Sæt derudover _Settings → Actions → General → Fork pull request workflows
> from outside collaborators_ til **Require approval for all external
> collaborators**.
>
> Vil du lukke hullet helt, så gør repoet privat. Det koster
> Actions-minutter (se [Hvad det koster](#hvad-det-koster)), men så kan ingen
> fork udløse noget overhovedet.

### 4. Hemmeligheder og variabler i GitHub

_Settings → Secrets and variables → Actions_.

Secrets:

| Navn                    | Hvad                          |
| ----------------------- | ----------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Samme token som til Terraform |
| `CLOUDFLARE_ACCOUNT_ID` | Konto-id                      |
| `CLOUDFLARE_ZONE_ID`    | Zone-id                       |
| `CLOUDFLARE_TUNNEL_ID`  | `terraform output tunnel_id`  |

Variables:

| Navn                | Eksempel                  |
| ------------------- | ------------------------- |
| `WORKER_NAME`       | `maanslogen-web`          |
| `WORKERS_SUBDOMAIN` | `dit-navn.workers.dev`    |
| `DEV_DOMAIN`        | `dev.maanslogen.dk`       |
| `PROD_API_HOST`     | `api.maanslogen.dk`       |
| `PROD_MEDIA_HOST`   | `media.maanslogen.dk`     |
| `DEV_MEDIA_HOST`    | `media.dev.maanslogen.dk` |

### 5. Første udrulning

```bash
cd apps/web
CLOUDFLARE_API_TOKEN=... NEXT_PUBLIC_API_URL=https://api.maanslogen.dk pnpm cf:deploy
```

Worker'en skal findes én gang, før `versions upload` kan lægge versioner op i
den. Derefter klarer `deploy.yml` det ved hvert push til `main`.

---

## Sådan kører et PR

1. Du åbner et PR.
2. `preview.yml` bygger web'en med `NEXT_PUBLIC_API_URL` sat til
   `https://api-pr-<n>.dev.maanslogen.dk` og lægger den op som en version med
   aliaset `pr-<n>`. Samtidig bygger runneren på Pi'en API-imaget, migrerer
   dev-databasen og starter `maanslogen-api-pr-<n>`.
3. DNS-navnet oprettes og peger ind i tunnelen. Caddy ser `api-pr-42.` i
   Host-headeren og sender videre til `maanslogen-api-pr-42:4000` — hverken
   tunnel eller Caddy skal røres.
4. En kommentar på PR'et får adresserne. Nye commits opdaterer den samme
   kommentar.
5. Du lukker PR'et. `preview-cleanup.yml` fjerner container, image og
   DNS-navn.

De to adresser kan regnes ud på forhånd, så web og API ikke venter på
hinanden. Det er også derfor `NEXT_PUBLIC_API_URL` sættes ved **build** og
ikke som en binding på Worker'en: Next inliner alt med `NEXT_PUBLIC_`-præfiks
ind i bundlen, også i serverkoden, så en binding ville blive skygget af
værdien der allerede står der. Det står uddybet i `apps/web/wrangler.jsonc`.

---

## Lokalt

**Alt lokalt** — standarden. Postgres og MinIO i Docker, ingen afhængighed af
noget udefra:

```bash
pnpm infra:up && pnpm dev
```

**Lokalt web mod dev** — når du arbejder på frontend og gerne vil have rigtige
data uden at køre resten:

```bash
cp apps/web/.env.dev.example apps/web/.env.local
pnpm dev:web
```

Hot reload som normalt, men data, indlogning og billeder kommer fra
dev-API'et. Postgres og MinIO behøver ikke køre. Tilbage igen med
`cp apps/web/.env.example apps/web/.env.local`.

**Lokalt API mod dev-databasen** — når fejlen er i API-koden, men data skal
være de samme som i previews. Databasen lytter kun på docker-netværket, så
lav en tunnel først:

```bash
ssh -N -L 5433:localhost:5432 pi@<pi-adresse>
cp apps/api/.env.dev.example apps/api/.env    # udfyld, se filen
pnpm dev:api
```

---

## Den fælles dev-database

Den deles af alle previews og af alle der udvikler lokalt. Det er enkelt, og
det koster:

- **En migrering i et PR rammer alle andre previews med det samme.**
  `preview.sh` kører `migrate deploy` inden containeren starter. Prisma-
  migreringer går kun fremad og er som regel additive, så det går sjældent
  galt — men et PR der fjerner en kolonne, fjerner den for alle.
- **Testdata skrider.** Halve anmeldelser, testbrugere, en migrering fra et
  PR der aldrig blev merget.

Derfor er der en knap: _Actions → **Nulstil dev-databasen** → Run workflow_,
skriv `nulstil`. Den dropper skemaet, kører alle migreringer igen og seeder
forfra.

> Nulstillingen kalder `prisma db seed` som et **selvstændigt** trin efter
> `migrate reset`. Prisma 6 seedede selv til sidst; Prisma 7 gør det ikke, og
> den siger ikke fra — den melder "Database reset successful" og efterlader en
> tom database. Workflowet tæller rækker bagefter og fejler hvis der er nul.

Produktionsdatabasen røres aldrig af noget af det her, og det er håndhævet i
databasen frem for kun aftalt: dev kører som rollen `maanslogen_dev`, som ikke
har CONNECT på produktionsdatabasen. Forsøger noget alligevel, svarer Postgres

```
FATAL: permission denied for database "maanslogen"
DETAIL: User does not have CONNECT privilege.
```

Den adskillelse er vigtigere end den ser ud. Uden den fik previews præcis
samme credentials som produktionen, og kun databasenavnet i forbindelses-URL'en
skilte dem ad — ét ord, som enhver kode i containeren kan ændre.

Produktionen har derudover sine egne JWT-nøgler, sin egen bucket og sit eget
skema.

---

## Hvad det koster

|         |                                                          |
| ------- | -------------------------------------------------------- |
| Workers | Gratis op til 100.000 forespørgsler/dag                  |
| R2      | Gratis: 10 GB, 1 mio. Class A, 10 mio. Class B pr. måned |
| Tunnel  | Gratis                                                   |
| DNS     | Gratis                                                   |
| Pi'en   | Strøm                                                    |

**GitHub Actions.** Repoet er offentligt, og på offentlige repoer er
GitHub-hostede runnere gratis uden loft. Målt på en rigtig kørsel: 239
sekunders væg-tid, `billable.UBUNTU.total_ms = 0`. Den selvhostede runner på
Pi'en tæller aldrig med — hverken på et offentligt eller et privat repo.

Gøres repoet privat, tæller de GitHub-hostede jobs med i den månedlige pulje
(2.000 minutter på GitHub Free, 3.000 på Pro). Forbruget målt på samme kørsel:

| Job                        | Hvor   | Tid    |
| -------------------------- | ------ | ------ |
| CI · typecheck, lint, test | GitHub | ~2 min |
| CI · Docker-images         | GitHub | ~4 min |
| Preview · web              | GitHub | ~4 min |
| Preview · API              | Pi'en  | gratis |
| Oprydning og nulstilling   | Pi'en  | gratis |

Cirka 10 minutter pr. push til et PR, altså omkring 200 pushes om måneden
inden for de 2.000.

Det eneste der reelt kan vælte tallene, er R2's Class B-operationer, og dem
holder cache-reglen nede. Regnestykket står i
[`r2-omkostninger.md`](r2-omkostninger.md).

Det er også derfor Worker'en ikke bruger Next's ISR-cache i R2, som
OpenNext-skabelonen ellers lægger op til: hver eneste rute i appen er
dynamisk, så der er intet at cache — men hver cache-læsning ville være en
Class B.

---

## Når noget driller

**Preview'et svarer 502.** Caddy fandt ikke containeren. På Pi'en:
`docker ps | grep pr-` og `docker logs maanslogen-api-pr-<n>`. Oftest gik den
ned ved opstart på en manglende variabel i `infra/pi/.env`.

**Preview'et svarer 404 med "ukendt vært".** Caddy kender ikke værtsnavnet.
Enten passer `PROD_API_HOST`/`DEV_API_HOST` i `.env` ikke med DNS, eller også
er navnet ikke på formen `api-pr-<cifre>.`.

**Web'en viser data, men indlogning fejler.** `CORS_ORIGINS` på API'et skal
indeholde præcis den adresse browseren kommer fra. Cookies sættes med
`SameSite=None; Secure`, fordi web og API ligger på hver sit domæne — derfor
virker det ikke over ren HTTP.

**`wrangler versions upload` siger at Worker'en ikke findes.** Den skal
udrulles én gang i hånden først, se trin 5.

**Runneren tager ikke jobbet.** Labels skal være `self-hosted` **og**
`maanslogen-pi`. Tjek med `sudo ./svc.sh status` i runner-mappen.
