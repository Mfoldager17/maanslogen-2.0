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
       │   GitHub ringer på, og agenten spørger:              │
       │     · hvilke åbne PR'er har label "preview"?          │
       │     · er der et nyt :main-image?                      │
       └───────────────────────────────────────────►  maanslogen-agent
```

**Ingen ordrer når ind til Pi'en.** Der er ingen selvhostet GitHub-runner.
GitHub ringer på med en webhook, men den er kun en dørklokke: agenten læser
ikke beskeden, den spørger GitHub selv og udfører kun `docker pull` og
`docker run` med argumenter, den selv bestemmer ud fra kode der ligger på
`main`. Se [`infra/pi/agent/`](../infra/pi/agent/).

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
skal findes, før Pi'en kan komme op.

|     |                                                   |                                           |
| --- | ------------------------------------------------- | ----------------------------------------- |
| 1   | Cloudflare                                        | token, buckets, tunnel, DNS               |
| 2   | Push til `main`, og **gør GHCR-pakken offentlig** | ellers kan Pi'en ikke hente imaget        |
| 3   | Pi'en                                             | klon, `.env`, `compose up`, skema og seed |
| 4   | Agenten                                           | systemd-tjenesten der henter fra GHCR     |
| 5   | Webhooken                                         | så du slipper for at vente på timeren     |
| 6   | GitHub                                            | hemmeligheder, variabler, `preview`-label |
| 7   | Første `wrangler deploy`                          | så Worker'en findes                       |

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

Appen kommer fra GHCR. Men `Caddyfile` og `init-dev-db.sh` **bind-mountes** ind
i containerne og skal derfor være rigtige filer på værtens disk,
`docker-compose.yml` læses fra disken, og agenten kører på værten — det er jo
den der styrer docker.

Det er 128 KB, ikke hele repoet, så klonen er sparse:

```bash
sudo useradd -r -G docker -s /usr/sbin/nologin maanslogen

sudo git clone --filter=blob:none --no-checkout --depth 1 \
  https://github.com/Mfoldager17/maanslogen-2.0 /opt/maanslogen
cd /opt/maanslogen
sudo git sparse-checkout set --no-cone infra/pi
sudo git checkout
sudo chown -R maanslogen /opt/maanslogen      # agenten skal kunne pulle
```

Det giver 11 filer og 344 KB i alt.

Hemmelighederne ligger uden for klonen, så en `git pull` aldrig kan røre dem:

```bash
sudo mkdir -p /etc/maanslogen
sudo cp /opt/maanslogen/infra/pi/.env.example /etc/maanslogen/pi.env
sudo chown maanslogen /etc/maanslogen/pi.env
sudo chmod 600 /etc/maanslogen/pi.env
```

Udfyld filen. Hemmeligheder genereres med `openssl rand -base64 48`, og prod og
dev skal have **hvert sit** sæt JWT-nøgler, så et token fra et preview ikke
virker i produktion. `CLOUDFLARE_TUNNEL_TOKEN` kommer fra
`terraform output -raw tunnel_token`.

Scripts finder selv filen: `MAANSLOGEN_ENV_FILE` hvis den er sat, ellers
`/etc/maanslogen/pi.env`, ellers en `.env` ved siden af `docker-compose.yml`.
Findes ingen af dem, siger de fra med det samme frem for at køre videre med
tomme variabler.

Så op med det hele:

```bash
cd /opt/maanslogen/infra/pi
sudo docker compose --env-file /etc/maanslogen/pi.env up -d
```

Første gang volumen er tom, opretter Postgres begge databaser og rollen
`maanslogen_dev`. Imaget hentes fra GHCR — det bygges **ikke** her, og derfor
skal pakken være offentlig (trin 2).

Til sidst skema og testdata:

```bash
cd /opt/maanslogen/infra/pi
. ./load-env.sh
image="${GHCR_IMAGE:-ghcr.io/mfoldager17/maanslogen-api}:main"

# Produktionen — egen rolle, eget netværk. Starter tom, uden testdata.
sudo docker run --rm --network maanslogen \
  -e DATABASE_URL="postgresql://$POSTGRES_USER:$POSTGRES_PASSWORD@postgres:5432/maanslogen?schema=public" \
  "$image" ./node_modules/.bin/prisma migrate deploy

# Dev — rollen maanslogen_dev, og netværket maanslogen-dev.
dev_url="postgresql://maanslogen_dev:$DEV_POSTGRES_PASSWORD@postgres:5432/maanslogen_dev?schema=public"
sudo docker run --rm --network maanslogen-dev -e DATABASE_URL="$dev_url" \
  "$image" ./node_modules/.bin/prisma migrate deploy
sudo docker run --rm --network maanslogen-dev -e DATABASE_URL="$dev_url" \
  "$image" ./node_modules/.bin/prisma db seed
```

### 4. Agenten på Pi'en

Pi'en skal kunne starte containere ud fra det GitHub siger. Det gøres **ikke**
med en selvhostet runner: den ville få tilsendt workflow-kode og udføre den som
en shell på maskinen, og på et offentligt repo kan enhver åbne et PR.

Klonen og brugeren er på plads fra trin 3, så der mangler kun tjenesten:

```bash
sudo cp /opt/maanslogen/infra/pi/agent/maanslogen-agent.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maanslogen-agent.timer
```

Klonen holder sig selv opdateret: unit-filen kører `git pull --ff-only` som
`ExecStartPre`, altså før hver kørsel. Det er ikke bekvemmelighed — hele
sikkerhedsargumentet er at _agenten kører main's kode_, og en klon der sakkede
bagud ville gøre den påstand usand uden at sige det.

Pull'et ligger i et selvstændigt trin og ikke inde i agenten, fordi bash læser
et script løbende under kørslen: et script der skriver sig selv om undervejs kan
ende med at udføre noget sludder.

Timeren her kører hver halve time, og det er **ikke** sådan udrulninger
normalt lander. Det klarer webhooken i næste trin på et par sekunder. Timeren
er sikkerhedsnettet: webhooks bliver væk — Pi'en genstarter, netværket
blinker, GitHub giver op efter ti sekunder — og uden den ville en tabt besked
betyde at en udrulning aldrig kom frem, uden at nogen opdagede det.

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

### 5. Webhooken, så du ikke skal vente

Uden den opdager Pi'en først en udrulning ved næste timer-kørsel, altså op til
en halv time senere. Med den er der gået et par sekunder.

På Pi'en:

```bash
# Læg hemmeligheden i samme fil som resten
echo "WEBHOOK_SECRET=$(openssl rand -hex 32)" | sudo tee -a /etc/maanslogen/pi.env
echo "DEPLOY_HOST=deploy.maanslogen.dk" | sudo tee -a /etc/maanslogen/pi.env

sudo cp /opt/maanslogen/infra/pi/agent/maanslogen-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maanslogen-webhook
sudo docker compose --env-file /etc/maanslogen/pi.env up -d caddy   # ny rute
```

DNS for `deploy.<domæne>` oprettes som de øvrige:

```bash
CF_API_TOKEN=... CF_ZONE_ID=... CF_TUNNEL_ID=... \
  infra/scripts/dns-record.sh upsert deploy.maanslogen.dk
```

I GitHub: _Settings → Webhooks → Add webhook_

| Felt         | Værdi                                                     |
| ------------ | --------------------------------------------------------- |
| Payload URL  | `https://deploy.maanslogen.dk/github`                     |
| Content type | `application/json`                                        |
| Secret       | den samme streng som `WEBHOOK_SECRET`                     |
| Events       | _Let me select individual events_ → kun **Workflow runs** |

`workflow_run` er nok til det hele. Den fyrer når `Udrul` er færdig med at
lægge et `:main`-image op, og når `Preview` er færdig med et `:pr-<n>` — og
også når oprydningen har kørt. Ét hændelsestype dækker både udrulning,
oprettelse og nedrivning.

> **Hvorfor det er forsvarligt at have en endpoint ind mod hjemmet.**
> Beskeden er kun en dørklokke. Modtageren læser ikke indholdet, den vækker
> bare agenten, som selv spørger GitHub hvad der bør køre. En forfalsket
> besked kan derfor ikke udrette andet end en ekstra kørsel af noget
> idempotent. Signaturen (HMAC-SHA256) tjekkes alligevel, så fremmede ikke kan
> holde Pi'en i gang, og modtageren kan i det hele taget kun gøre én ting.
>
> Vil du stramme yderligere, kan du på Cloudflare afvise alt der ikke kommer
> fra GitHubs IP-intervaller, før det overhovedet når tunnelen.

### 6. Hemmeligheder, variabler og label i GitHub

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

### 7. Første udrulning

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
4. Når workflowet er færdigt, sender GitHub en webhook til Pi'en. Agenten
   vækkes med det samme, ser at PR'et står på listen, henter imaget, migrerer
   dev-databasen og starter
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
sekunders væg-tid, `billable.UBUNTU.total_ms = 0`.

Alt bygges på GitHub. Pi'en kører ingen jobs — den henter færdige images og
forbruger derfor ingen minutter, uanset repoets synlighed.

Gøres repoet privat, tæller de GitHub-hostede jobs med i den månedlige pulje
(2.000 minutter på GitHub Free, 3.000 på Pro):

| Job                        | Hvor               | Tid    |
| -------------------------- | ------------------ | ------ |
| CI · typecheck, lint, test | `ubuntu-latest`    | ~2 min |
| CI · Docker-images         | `ubuntu-latest`    | ~4 min |
| Udrul/Preview · API-image  | `ubuntu-24.04-arm` | ~4 min |
| Udrul/Preview · web        | `ubuntu-latest`    | ~4 min |
| DNS og kommentar           | `ubuntu-latest`    | <1 min |
| Agent og nulstilling af db | Pi'en, ingen CI    | gratis |

Cirka 15 minutter pr. push til et PR med preview, altså omkring 130 pushes om
måneden inden for de 2.000. Bemærk at `ubuntu-24.04-arm` kun er gratis på
offentlige repoer — på et privat repo tæller den med som alle andre.

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

**Udrulningen til produktion sker ikke.** Normalt går der sekunder: GitHub
sender en webhook, når workflowet er færdigt. Sker der intet, så tjek i
rækkefølge:

1. Kom der et image op? Se _Actions_ og _Packages_.
2. Nåede webhooken frem? _Settings → Webhooks → Recent Deliveries_ viser hvert
   forsøg og svaret. 401 betyder at `WEBHOOK_SECRET` ikke er den samme de to
   steder.
3. `journalctl -u maanslogen-webhook -n 30` og
   `journalctl -u maanslogen-agent -n 30`.

Timeren fanger det alligevel inden for en halv time — den findes netop til de
beskeder der bliver væk.

**Web'en viser data, men indlogning fejler.** `CORS_ORIGINS` på API'et skal
indeholde præcis den adresse browseren kommer fra. Cookies sættes med
`SameSite=None; Secure`, fordi web og API ligger på hver sit domæne — derfor
virker det ikke over ren HTTP.

**`wrangler versions upload` siger at Worker'en ikke findes.** Den skal
udrulles én gang i hånden først, se trin 7.
