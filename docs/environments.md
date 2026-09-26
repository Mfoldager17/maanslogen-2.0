# Miljøer

To miljøer. **Produktion** kører altid. **Dev** findes kun så længe der er et
åbent PR — eller så længe du selv har noget kørende lokalt.

```
GitHub-hosted runner            Cloudflare             Pi'en
────────────────────            ──────────             ─────────────────────
ubuntu-24.04-arm                Workers (web)          Postgres
  bygger arm64-image              maanslogen.dk          · maanslogen
       │                               │                  · maanslogen_dev
       ▼                               │ fetch
     GHCR                              ▼                 api        (prod)
  · :main                         Tunnel ─► Caddy ─►     api-dev    (main)
  · :pr-42                                               api-pr-42  (preview)
       │                                                      ▲
       │   Pi'en spørger hvert andet minut:                   │
       │     · hvilke åbne PR'er har label "preview"?          │
       │     · er der et nyt :main-image?                      │
       └───────────────────────────────────────────►  maanslogen-agent
```

**Intet skubber til Pi'en.** Der er ingen selvhostet GitHub-runner. Pi'en
spørger selv og udfører kun `docker pull` og `docker run` med argumenter, den
selv bestemmer ud fra kode der ligger på `main`. Se
[`infra/pi/agent/`](../infra/pi/agent/).

|          | Produktion              | Dev                                        |
| -------- | ----------------------- | ------------------------------------------ |
| Web      | Worker `maanslogen-web` | Worker-**version** pr. PR, egen URL        |
| API      | Container på Pi'en      | Container pr. PR + ét delt dev-API         |
| Database | `maanslogen`            | `maanslogen_dev` — **én, fælles**          |
| Billeder | `maanslogen-media`      | `maanslogen-media-dev`                     |
| Opstår   | Push til `main`         | Når label'en `preview` sættes              |
| Lever    | Altid                   | Indtil label'en fjernes eller PR'et lukkes |

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

**Rækkefølgen betyder noget.** Pi'ens containere hentes fra GHCR, så imaget
skal findes, før Pi'en kan komme op. Kort sagt:

|     |                               |                                           |
| --- | ----------------------------- | ----------------------------------------- |
| 1   | Cloudflare                    | token, buckets, tunnel, DNS               |
| 2   | GitHub                        | hemmeligheder, variabler, `preview`-label |
| 3   | Push til `main`               | bygger imaget og lægger det i GHCR        |
| 4   | **Gør GHCR-pakken offentlig** | ellers kan Pi'en ikke hente den           |
| 5   | Pi'en                         | `.env`, `compose up`, agent, seed         |
| 6   | Første `wrangler deploy`      | så Worker'en findes                       |

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

### 2. GHCR-pakken skal være offentlig

Første push til `main` bygger API-imaget og lægger det i GHCR. **Pakken er
privat som udgangspunkt**, og Pi'en har med vilje ingen credentials — så
`docker pull` ville svare `denied`, og agenten ville vente i det uendelige på
et image den ikke må se.

Efter første vellykkede kørsel af _Udrul_: gå til repoets forside →
**Packages** → `maanslogen-api` → _Package settings_ → **Change visibility** →
_Public_.

Koden er offentlig i forvejen, så imaget afslører ikke noget nyt.

> Vil du hellere holde pakken privat, skal Pi'en logge ind:
> `docker login ghcr.io -u <bruger> -p <token>` med et token der har
> `read:packages`. Så har Pi'en til gengæld en credential, og det var netop
> det vi gerne ville undgå.

### 3. Pi'en

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

### 4. Agenten på Pi'en

Pi'en skal kunne starte containere ud fra det GitHub siger. Det gøres **ikke**
med en selvhostet runner: den ville få tilsendt workflow-kode og udføre den
som en shell på maskinen, og på et offentligt repo kan enhver åbne et PR.

I stedet spørger Pi'en selv.

```bash
sudo useradd -r -G docker -s /usr/sbin/nologin maanslogen
sudo git clone https://github.com/Mfoldager17/maanslogen-2.0 /opt/maanslogen
sudo cp /opt/maanslogen/infra/pi/agent/maanslogen-agent.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maanslogen-agent.timer
```

`/opt/maanslogen` skal blive på `main` — det er den klon agenten kører fra, og
pointen er netop at et PR ikke kan ændre den:

```bash
cd /opt/maanslogen && sudo git pull origin main
```

Følg med:

```bash
journalctl -u maanslogen-agent -f
sudo systemctl start maanslogen-agent    # kør med det samme
```

> **Hvorfor det er forsvarligt på et offentligt repo.** Tre ting skal være
> opfyldt, før et PR får en container, og de er uafhængige af hinanden:
>
> 1. **Der findes et image i GHCR.** Et PR fra en fork får et skrivebeskyttet
>    `GITHUB_TOKEN` og kan derfor ikke lægge et image op. Det er ikke en regel
>    vi håndhæver — det er noget en fork ikke _kan_.
> 2. **PR'et har label'en `preview`**, og labels kan kun sættes af nogen med
>    skriveadgang. Et tilfældigt PR udefra gør altså ingenting, før du selv
>    beder om det.
> 3. **Grenen ligger i repoet selv.** Tjekkes både i workflowet og i agenten.
>
> Og skulle noget alligevel komme igennem: containeren kører uden skrivbart
> rodfilsystem, uden capabilities, uden rettighedsforfremmelse, med loft på
> hukommelse og processer, på et netværk hvor produktions-API'et ikke er, og
> med en databaserolle der ikke har CONNECT på produktionsdatabasen. Den kører
> PR-kode, men den kører den i en spændetrøje.
>
> Forskellen til en runner er værd at holde fast i: en runner giver PR-kode en
> **shell på værten**, med adgang til hemmelighedsfilen og docker-socket — og
> docker-socket er reelt root. En container er en helt almindelig sandkasse.

### 5. Hemmeligheder, variabler og label i GitHub

Opret først label'en **`preview`** under _Issues → Labels_. Den er porten til
et preview-miljø; uden den sker der ingenting, når du sætter den på et PR.

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

### 6. Første udrulning

```bash
cd apps/web
CLOUDFLARE_API_TOKEN=... NEXT_PUBLIC_API_URL=https://api.maanslogen.dk pnpm cf:deploy
```

Worker'en skal findes én gang, før `versions upload` kan lægge versioner op i
den. Derefter klarer `deploy.yml` det ved hvert push til `main`.

Så er du kørende. Tjek til sidst:

```bash
# På Pi'en
docker ps                              # postgres, api, api-dev, caddy, cloudflared
journalctl -u maanslogen-agent -n 20   # "api: opdateret" eller ingen ændring

# Udefra
curl -s https://api.maanslogen.dk/api/v1/health/ready
curl -s https://maanslogen.dk -o /dev/null -w '%{http_code}\n'
```

---

## Sådan kører et PR

1. Du åbner et PR. **Der sker ingenting endnu.**
2. Du sætter label'en `preview`. Det er porten, og den kan kun åbnes af nogen
   med skriveadgang.
3. `preview.yml` bygger API-imaget på en `ubuntu-24.04-arm`-runner — native
   arm64, og gratis på et offentligt repo — og lægger det i GHCR som
   `:pr-<n>`. Samtidig bygges web'en og lægges op som en Worker-version med
   aliaset `pr-<n>`, og DNS-navnet oprettes.
4. Inden for to minutter ser agenten på Pi'en, at PR'et står på listen. Den
   henter imaget, migrerer dev-databasen og starter
   `maanslogen-api-pr-<n>`. Caddy genkender `api-pr-<n>.` i Host-headeren og
   sender videre — hverken tunnel eller Caddy skal røres.
5. En kommentar på PR'et får adresserne. Nye commits opdaterer den samme
   kommentar.
6. Du fjerner label'en eller lukker PR'et. Workflowet fjerner DNS-navnet, og
   agenten ser ved næste kørsel at PR'et er væk og stopper containeren.

De to adresser kan regnes ud på forhånd, så web og API ikke venter på
hinanden. Det er også derfor `NEXT_PUBLIC_API_URL` sættes ved **build** og
ikke som en binding på Worker'en: Next inliner alt med `NEXT_PUBLIC_`-præfiks
ind i bundlen, også i serverkoden, så en binding ville blive skygget af
værdien der allerede står der. Det står uddybet i `apps/web/wrangler.jsonc`.

Højst tre previews kører ad gangen (`MAX_PREVIEWS`). Hver tager omkring
250 MB, og produktionen skal have plads.

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
  Agenten kører `migrate deploy` inden containeren starter. Prisma-
  migreringer går kun fremad og er som regel additive, så det går sjældent
  galt — men et PR der fjerner en kolonne, fjerner den for alle.
- **Testdata skrider.** Halve anmeldelser, testbrugere, en migrering fra et
  PR der aldrig blev merget.

Derfor findes der en nulstilling. Den ligger på Pi'en og ikke som et
workflow, fordi et workflow ville kræve en selvhostet runner — og det er
netop det vi ikke har. En destruktiv og sjælden handling har i øvrigt godt af
et menneske ved tastaturet:

```bash
sudo -u maanslogen /opt/maanslogen/infra/pi/nulstil-dev-db.sh
```

Den beder om bekræftelse, dropper skemaet, kører alle migreringer igen og
seeder forfra.

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

**Preview'et kommer ikke op.** Tjek i rækkefølge:

1. Har PR'et label'en `preview`? Uden den sker der intet.
2. Kørte `preview.yml` og lagde et image op? Se _Actions_, og
   _Packages_ på repoet.
3. Har agenten set det? På Pi'en: `journalctl -u maanslogen-agent -n 50`.
   Den skriver `pr-42: intet image i GHCR endnu — venter`, hvis den kom først.
4. Er der plads? `MAX_PREVIEWS` er 3. Agenten tager de laveste PR-numre.

**Preview'et svarer 502.** Caddy fandt ikke containeren.
`docker ps | grep pr-` og `docker logs maanslogen-api-pr-<n>`. Oftest gik den
ned ved opstart på en manglende variabel i `/etc/maanslogen/pi.env`. Husk at
containeren kører med `--read-only`; skriver koden uden for `/tmp`, fejler den.

**Preview'et svarer 404 med "ukendt vært".** Caddy kender ikke værtsnavnet.
Enten passer `PROD_API_HOST`/`DEV_API_HOST` ikke med DNS, eller også er navnet
ikke på formen `api-pr-<cifre>.`.

**Agenten gør ingenting.** `systemctl list-timers maanslogen-agent.timer`.
Rammer du GitHubs grænse på 60 kald i timen (uautentificeret), står det i
loggen — sæt et skrivebeskyttet `GITHUB_TOKEN` i `/etc/maanslogen/pi.env`.

**Udrulningen til produktion sker ikke.** Agenten opdager et nyt `:main`-image
inden for to minutter. Kom der et image op? Se _Actions_ og _Packages_. Ellers
`journalctl -u maanslogen-agent`.

**Web'en viser data, men indlogning fejler.** `CORS_ORIGINS` på API'et skal
indeholde præcis den adresse browseren kommer fra. Cookies sættes med
`SameSite=None; Secure`, fordi web og API ligger på hver sit domæne — derfor
virker det ikke over ren HTTP.

**`wrangler versions upload` siger at Worker'en ikke findes.** Den skal
udrulles én gang i hånden først, se trin 5.
