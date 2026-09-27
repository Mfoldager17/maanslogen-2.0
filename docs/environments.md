# Miljøer

Tre trin, og de flyttes af hver sin ting:

| Trin           | Flyttes af              | Image   |
| -------------- | ----------------------- | ------- |
| **Dev**        | Label'en `dev` på et PR | `:dev`  |
| **Staging**    | Push til `main`         | `:main` |
| **Produktion** | Et **release** i GitHub | `:prod` |

Et push til main går altså ikke længere i produktion. Det går til staging, og
produktionen flytter sig først når du laver et release — og kun til kode der
allerede har stået på staging: release-workflowet bygger ikke noget nyt, det
forfremmer det image der blev bygget for den commit.

Dev og staging deler database og billedbucket. Det er et bevidst valg:
staging findes for at køre main et rigtigt sted før et release, ikke for at
have sit eget datasæt.

Der er ét dev-miljø, ikke ét pr. PR. Har tre PR'er label'en, får det seneste
der blev bygget miljøet — de andre venter ikke i kø, de bliver bare
overtaget. Koden til ét preview pr. PR ligger parkeret i
[`preview.yml.parkeret`](../.github/workflows/preview.yml.parkeret) og nederst
i agenten, så den kan tages op igen.

```
GitHub-hosted runner            Cloudflare             Pi'en
────────────────────            ──────────             ─────────────────────
ubuntu-24.04-arm                Workers (web)          Postgres
  bygger arm64-image              maanslogen-web          · maanslogen
       │                               │                  · maanslogen_dev
       ▼                               │ fetch
     GHCR                              ▼                 api         (:prod)
  · :prod  ← release              Tunnel ─► Caddy ─►     api-staging (:main)
  · :main  ← push til main                               api-dev     (:dev)
  · :dev   ← label på et PR                                    ▲
       │                                                       │
       │   GitHub ringer på, og agenten spørger:               │
       │     · har et åbent PR label'en "dev"?                 │
       │     · er der nye :prod-, :main- eller :dev-images?    │
       └───────────────────────────────────────────►  maanslogen-agent
```

**Ingen ordrer når ind til Pi'en.** Der er ingen selvhostet GitHub-runner.
GitHub ringer på med en webhook, men den er kun en dørklokke: agenten læser
ikke beskeden, den spørger GitHub selv og udfører kun `docker pull` og
`docker run` med argumenter, den selv bestemmer ud fra kode der ligger på
`main`. Se [`infra/pi/agent/`](../infra/pi/agent/).

|          | Produktion              | Staging                | Dev                                  |
| -------- | ----------------------- | ---------------------- | ------------------------------------ |
| Web      | Worker `maanslogen-web` | Alias `staging`        | Alias `dev`                          |
| API      | `api`                   | `api-staging`          | `api-dev`                            |
| Database | `maanslogen`            | `maanslogen_dev`       | `maanslogen_dev` — **delt**          |
| Billeder | `maanslogen-media`      | `maanslogen-media-dev` | `maanslogen-media-dev`               |
| Følger   | Seneste release         | `main`                 | PR med label'en `dev`, ellers `main` |
| Lever    | Altid                   | Altid                  | Altid — skifter hvad den viser       |

---

## Hvorfor sådan her

**Web på Workers.** Next 16 kører på Workers gennem
[`@opennextjs/cloudflare`](https://opennext.js.org/cloudflare). Bundlen er
1,5 MB gzippet mod gratisplanens 3 MB, og gratisplanen giver 100.000
forespørgsler om dagen. Dev bruger `wrangler versions upload` med aliaset
`dev`, som lægger en version op på sin egen faste URL **uden** at røre den
der er udrullet. Derfor er der ingen Worker at rydde op i bagefter — og
adressen er den samme fra gang til gang, så CORS-listen på Pi'en ikke skal
følge med fra PR til PR.

**API på Pi'en.** Du spurgte om der fandtes et gratis alternativ. Kort svar:
ikke et der er bedre end Pi'en.

|                       | Hvad der er hagen                                                    |
| --------------------- | -------------------------------------------------------------------- |
| Render free           | Sover efter 15 minutter. Første besøgende venter ~50 sekunder.       |
| Fly.io                | Ikke længere rigtig gratis — pay-as-you-go med et månedligt minimum. |
| Cloudflare Containers | Kræver Workers Paid, fra 5 $/md.                                     |
| Koyeb free            | Én tjeneste, og så er der ikke plads til dev ved siden af.           |
| Oracle Always Free    | Reelt gratis og stærk nok, men tilmelding og kapacitet driller.      |

Og uanset hvad skal databasen ligge et sted med vedvarende lagring. Når
Postgres alligevel skal køre på Pi'en, koster API'et ved siden af ingenting.
Så: Pi'en, og Cloudflare Tunnel foran. Ingen port åbnes i routeren, der skal
ikke være en fast IP-adresse, og Pi'ens adresse bliver aldrig offentlig.

Skal det senere flyttes, er det kun `infra/pi/` der skal skiftes ud —
imaget er det samme, og web'en kender kun et værtsnavn.

**Én dev-database.** Dev-miljøet og lokal udvikling deler `maanslogen_dev`.
Det er enklere end en database pr. PR, og det er det du bad om. Konsekvensen
står nedenfor, og den er værd at kende.

---

## Hvorfor navnene ser sådan ud

Alle værtsnavne har formen `<rolle>-maanslogen.mathiasfoldager.com`:

| Rolle        | Værtsnavn                                    |
| ------------ | -------------------------------------------- |
| Site         | `maanslogen.mathiasfoldager.com`             |
| API          | `api-maanslogen.mathiasfoldager.com`         |
| API staging  | `api-staging-maanslogen.mathiasfoldager.com` |
| API dev      | `api-dev-maanslogen.mathiasfoldager.com`     |
| Billeder     | `media-maanslogen.mathiasfoldager.com`       |
| Billeder dev | `media-dev-maanslogen.mathiasfoldager.com`   |
| Webhook      | `deploy-maanslogen.mathiasfoldager.com`      |

Bindestreg mellem rolle og projekt, ikke punktum — og det er ikke en smagssag.
Cloudflares gratis universalcertifikat dækker `*.mathiasfoldager.com`, men
**ikke** `*.*.mathiasfoldager.com`. Et navn som `api.dev.maanslogen.mathiasfoldager.com`
ville derfor stå uden certifikat og kun kunne nås gennem et betalt Advanced
Certificate. Ét niveau under zonen, altid.

Det er også derfor `COOKIE_DOMAIN` ikke sættes: se
[`deployment.md`](deployment.md#cookies-på-tværs-af-værter).

De fem navne Terraform opretter — API'erne og billeddomænerne — bygges ét
sted, i `local.vaert` i
[`infra/terraform/variables.tf`](../infra/terraform/variables.tf). Den dag
`maanslogen.com` er købt, er det de fem linjer der bliver til
`api.maanslogen.com` osv., og `dns.tf` og `cache.tf` læser derfra.

Sitet ligger på en Worker og har ingen DNS-record her; webhook-navnet
oprettes af [`infra/scripts/dns-record.sh`](../infra/scripts/dns-record.sh).
De to skal rettes i hånden.

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
| 6   | GitHub                                            | hemmeligheder, variabler, `dev`-label     |
| 7   | Første `wrangler deploy`                          | så Worker'en findes                       |
| 8   | Backup                                            | natligt dump af produktionen op i R2      |

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
  `media-maanslogen.mathiasfoldager.com` til prod-bucketen og
  `media-dev-maanslogen.mathiasfoldager.com` til dev-bucketen.
- **Caching → Tiered Cache**: slå Smart Tiered Caching til. Gratis, og det
  skærer i Class B-operationerne. Se [`r2-omkostninger.md`](r2-omkostninger.md).

### 2. GHCR-pakken skal være offentlig

Første push til `main` bygger API-imaget og lægger det i GHCR. **Pakken er
privat som udgangspunkt**, og Pi'en har med vilje ingen credentials — så
`docker pull` ville svare `denied`, og agenten ville vente i det uendelige på
et image den ikke må se.

Efter første vellykkede kørsel af _Staging_: gå til repoets forside →
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
dev skal have **hvert sit** sæt JWT-nøgler, så et token fra dev ikke
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
> 2. **PR'et har label'en `dev`**, og labels kan kun sættes af nogen med
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
echo "DEPLOY_HOST=deploy-maanslogen.mathiasfoldager.com" | sudo tee -a /etc/maanslogen/pi.env

sudo cp /opt/maanslogen/infra/pi/agent/maanslogen-webhook.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maanslogen-webhook
sudo docker compose --env-file /etc/maanslogen/pi.env up -d caddy   # ny rute
```

DNS for `deploy.<domæne>` oprettes som de øvrige:

```bash
CF_API_TOKEN=... CF_ZONE_ID=... CF_TUNNEL_ID=... \
  infra/scripts/dns-record.sh upsert deploy-maanslogen.mathiasfoldager.com
```

I GitHub: _Settings → Webhooks → Add webhook_

| Felt         | Værdi                                                     |
| ------------ | --------------------------------------------------------- |
| Payload URL  | `https://deploy-maanslogen.mathiasfoldager.com/github`    |
| Content type | `application/json`                                        |
| Secret       | den samme streng som `WEBHOOK_SECRET`                     |
| Events       | _Let me select individual events_ → kun **Workflow runs** |

`workflow_run` er nok til det hele. Den fyrer når `Staging` er færdig med et
`:main`-image, når `Dev` er færdig med et `:dev`, og når `Produktion` har
forfremmet et `:prod`. Én hændelsestype dækker alle tre trin.

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

Opret først label'en **`dev`** under _Issues → Labels_ — præcis den
stavemåde, med småt. Den er porten til dev-miljøet; uden den sker der
ingenting, når du sætter den på et PR. Navnet skal matche `DEV_LABEL` i
`/etc/maanslogen/pi.env` og betingelsen i `dev.yml`.

_Settings → Secrets and variables → Actions_.

Secrets:

| Navn                    | Hvad                          |
| ----------------------- | ----------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Samme token som til Terraform |
| `CLOUDFLARE_ACCOUNT_ID` | Konto-id                      |
| `CLOUDFLARE_ZONE_ID`    | Zone-id                       |
| `CLOUDFLARE_TUNNEL_ID`  | `terraform output tunnel_id`  |

Variables:

| Navn                | Eksempel                                     |
| ------------------- | -------------------------------------------- |
| `WORKER_NAME`       | `maanslogen-web`                             |
| `WORKERS_SUBDOMAIN` | `dit-navn.workers.dev`                       |
| `PROD_API_HOST`     | `api-maanslogen.mathiasfoldager.com`         |
| `STAGING_API_HOST`  | `api-staging-maanslogen.mathiasfoldager.com` |
| `DEV_API_HOST`      | `api-dev-maanslogen.mathiasfoldager.com`     |
| `PROD_MEDIA_HOST`   | `media-maanslogen.mathiasfoldager.com`       |
| `DEV_MEDIA_HOST`    | `media-dev-maanslogen.mathiasfoldager.com`   |

Alle fem er hele værtsnavne. Der var før en `DEV_DOMAIN`, som workflowet satte
`api.` foran — den findes ikke længere, netop fordi navnene ikke stables i
niveauer mere. Se «Hvorfor navnene ser sådan ud» ovenfor.

`STAGING_API_HOST` bruges af staging-workflowet; billederne henter staging fra
`DEV_MEDIA_HOST`, fordi den deler bucket med dev.

### 7. Første udrulning

```bash
cd apps/web
CLOUDFLARE_API_TOKEN=... NEXT_PUBLIC_API_URL=https://api-maanslogen.mathiasfoldager.com pnpm cf:deploy
```

Worker'en skal findes én gang, før `versions upload` kan lægge versioner op i
den. Derefter klarer `deploy.yml` det ved hvert push til `main`.

Så er du kørende. Tjek til sidst:

```bash
# På Pi'en
docker ps                              # postgres, api, api-dev, caddy, cloudflared
journalctl -u maanslogen-agent -n 20   # "api: opdateret" eller ingen ændring

# Udefra
curl -s https://api-maanslogen.mathiasfoldager.com/api/v1/health/ready
curl -s https://maanslogen.mathiasfoldager.com -o /dev/null -w '%{http_code}\n'
```

### 8. Backup af produktionen

Produktionsdatabasen findes ét sted, på én disk, i dit hjem. Booter Pi'en fra
et SD-kort, er det også den mest sandsynlige hardwarefejl du har.

Kun produktionen tages der backup af. Dev-databasen er testdata, som
`prisma db seed` genskaber på et minut, og et dump af den ville kun være støj.

Lav først en **egen** R2-token under _R2 → Manage API tokens_ med Object Read &
Write, begrænset til `maanslogen-backup`. Ikke den samme som API'et bruger til
billeder: kan nøglen der uploader billeder også slette dumps, er backuppen ikke
beskyttet mod det den er der for at overleve. Læg den i env-filen som
`R2_BACKUP_ACCESS_KEY_ID` og `R2_BACKUP_SECRET_ACCESS_KEY`.

```bash
sudo cp /opt/maanslogen/infra/pi/backup/maanslogen-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now maanslogen-backup.timer

# Kør den med det samme frem for at vente til 03:15
sudo systemctl start maanslogen-backup
journalctl -u maanslogen-backup -n 20
```

En kørsel skriver fire linjer og skal ende med `oprydning`:

```
dumper maanslogen
dump ok: 20 tabeller, 11296808 B → 2023612 B pakket
lægger op: prod/2026-09-27T031500Z.sql.gz
bekræftet i bucketen: 2023612 B
oprydning: 0 ældre end 2026-08-28 slettet
```

Dumpet efterprøves **før** det lægges op, og læses tilbage **efter**. Et halvt
dump i bucketen er værre end intet, for så ser der ud til at være backup.

---

## Backup og genskabelse

Timeren kører 03:15 med op til et kvarters spredning, og `Persistent=true`
betyder at en nat hvor Pi'en var slukket bliver indhentet ved næste opstart.
Dumps beholdes 30 dage (`BACKUP_RETENTION_DAYS`).

**En backup du aldrig har lagt tilbage, er ikke en backup.** Prøv det her én
gang nu, mens der ikke er noget på spil — ikke første gang du får brug for det.

```bash
cd /opt/maanslogen/infra/pi
. ./load-env.sh

r2() {
  curl --fail-with-body -sS --aws-sigv4 "aws:amz:auto:s3" \
    --user "${R2_BACKUP_ACCESS_KEY_ID}:${R2_BACKUP_SECRET_ACCESS_KEY}" "$@"
}
vaert="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${R2_BACKUP_BUCKET}"

# 1. Find den nyeste. Bemærk %2F — en rå skråstreg i query-strengen får
#    signaturen til ikke at passe, og svaret bliver 403.
noegle=$(r2 "${vaert}?list-type=2&prefix=prod%2F" \
  | grep -o '<Key>[^<]*</Key>' | sed 's|</\?Key>||g' | sort | tail -1)
echo "$noegle"

# 2. Hent og pak ud
r2 "${vaert}/${noegle}" -o /tmp/genskab.sql.gz
gunzip -f /tmp/genskab.sql.gz

# 3. Læg den i en NY database først. Aldrig direkte oven i produktionen —
#    er dumpet forkert, har du så mistet begge dele.
docker compose --env-file "$MAANSLOGEN_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d postgres -c 'CREATE DATABASE maanslogen_genskabt'
docker compose --env-file "$MAANSLOGEN_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d maanslogen_genskabt -v ON_ERROR_STOP=1 -q < /tmp/genskab.sql

# 4. Se efter at der er noget i den
docker compose --env-file "$MAANSLOGEN_ENV_FILE" exec -T postgres \
  psql -U "$POSTGRES_USER" -d maanslogen_genskabt \
  -c 'select count(*) from beverages' -c 'select count(*) from reviews'
```

Ser det rigtigt ud, kan `api` pekes på den nye database, eller den gamle
omdøbes væk og den nye tage dens navn. Der er med vilje ikke noget script til
det trin: en genskabelse er sjælden og dyr at gøre forkert, og de to linjer
skal skrives bevidst frem for at blive kaldt.

Dumpet er ren SQL med `--no-owner --no-privileges`, så det kan lægges ind
under et andet rollenavn end det kom fra. Ved en genskabelse på en frisk
maskine hedder rollerne sjældent det samme, og uden dem ville hver eneste
GRANT fejle.

---

## Fra main til produktion

1. Du merger et PR. `Staging` bygger `:main` og `:<sha>`, og lægger web op på
   aliaset `staging`. Agenten genstarter `api-staging`.
2. Du prøver det af på staging-adresserne. Produktionen er urørt.
3. Du laver et **release** i GitHub på den commit. `Produktion` forfremmer
   `:<sha>` til `:prod` og `:<tag>` — uden at bygge noget nyt — og udruller
   web'en med `wrangler deploy`.
4. Agenten ser det nye `:prod`, migrerer produktionsdatabasen og genstarter
   `api`.

**Forfremmelsen er porten.** Release-workflowet bygger ikke fra kildekode; det
sætter et nyt tag på det image der allerede ligger. Findes der ikke et image
for release'ets commit, stopper det med en forklaring. Du kan altså ikke
udrulle kode der aldrig har været på main og igennem staging — ikke fordi en
regel forbyder det, men fordi der ikke er noget at forfremme.

Et **pre-release** springes over. Det er en prøveballon, ikke en udrulning.

> **Første gang.** `:prod` findes ikke, før du har lavet det første release.
> Indtil da lader agenten produktionen stå på det den allerede kører og
> skriver `prod: intet :prod-image (intet release endnu)` i loggen. Den
> falder med vilje ikke tilbage til `:main` — det ville omgå hele pointen.

---

## Sådan kører et PR

1. Du åbner et PR. **Der sker ingenting endnu.**
2. Du sætter label'en `dev`. Det er porten, og den kan kun åbnes af nogen
   med skriveadgang.
3. `dev.yml` bygger API-imaget på en `ubuntu-24.04-arm`-runner — native
   arm64, og gratis på et offentligt repo — og lægger det i GHCR som `:dev`.
   Samtidig bygges web'en og lægges op som en Worker-version på aliaset
   `dev`. Begge tags er faste; der oprettes ingen DNS-navne, for
   `api.dev.<domæne>` findes allerede fra Terraform.
4. Når workflowet er færdigt, sender GitHub en webhook til Pi'en. Agenten
   vækkes med det samme, ser at et PR har label'en, henter `:dev`, migrerer
   dev-databasen og genstarter `api-dev` på det image. Caddy kender allerede
   værtsnavnet — hverken tunnel eller Caddy skal røres.
5. En kommentar på PR'et får adresserne. Nye commits opdaterer den samme
   kommentar.
6. Du fjerner label'en fra alle PR'er. Agenten ser ved næste kørsel at ingen
   gør krav på miljøet, og sætter `api-dev` tilbage på `:main`.

**Der er ét miljø.** Sætter du label'en på PR nummer to, overtager det
miljøet fra det første — uden at spørge, og uden at det første får besked.
Workflowet kører i ét globalt `concurrency`-spor med `cancel-in-progress`,
så en igangværende bygning bliver afbrudt af den næste. Det er hele
mekanikken bag "den seneste vinder".

De to adresser kan regnes ud på forhånd, så web og API ikke venter på
hinanden. Det er også derfor `NEXT_PUBLIC_API_URL` sættes ved **build** og
ikke som en binding på Worker'en: Next inliner alt med `NEXT_PUBLIC_`-præfiks
ind i bundlen, også i serverkoden, så en binding ville blive skygget af
værdien der allerede står der. Det står uddybet i `apps/web/wrangler.jsonc`.

Ét dev-API ad gangen. Det var netop pladsen der var grunden til at previews
havde et loft (`MAX_PREVIEWS`, tre stykker à ~250 MB) — med ét fælles miljø
er det spørgsmål væk.

---

## Lokalt

**Alt lokalt** — standarden. Postgres og en S3-server i Docker, ingen afhængighed af
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
dev-API'et. Postgres og S3-serveren behøver ikke køre. Tilbage igen med
`cp apps/web/.env.example apps/web/.env.local`.

**Lokalt API mod dev-databasen** — når fejlen er i API-koden, men data skal
være de samme som i dev-miljøet. Databasen lytter kun på docker-netværket, så
lav en tunnel først:

```bash
ssh -N -L 5433:localhost:5432 pi@<pi-adresse>
cp apps/api/.env.dev.example apps/api/.env    # udfyld, se filen
pnpm dev:api
```

---

## Den fælles dev-database

Den deles af dev-miljøet og af alle der udvikler lokalt. Det er enkelt, og
det koster:

- **En migrering i et PR rammer alle der udvikler lokalt med det samme.**
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
seeder forfra — omkring 620 drikkevarer og 9.100 anmeldelser, hvilket tager
et halvt minut.

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

Den adskillelse er vigtigere end den ser ud. Uden den fik dev-miljøet præcis
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
| Backup  | ~2 MB pr. nat, 30 dages opbevaring — 60 MB af R2' 10 GB  |

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
| Staging/Dev · API-image    | `ubuntu-24.04-arm` | ~4 min |
| Staging/Dev · web          | `ubuntu-latest`    | ~4 min |
| Produktion · forfremmelse  | `ubuntu-latest`    | <1 min |
| Produktion · web           | `ubuntu-latest`    | ~4 min |
| Kommentar                  | `ubuntu-latest`    | <1 min |
| Agent og nulstilling af db | Pi'en, ingen CI    | gratis |

Cirka 15 minutter pr. push til et PR med label'en `dev`, altså omkring 130
pushes om måneden inden for de 2.000. Med ét miljø er der desuden højst ét
PR der bruger dem ad gangen. Bemærk at `ubuntu-24.04-arm` kun er gratis på
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

**Dev viser stadig den gamle kode.** Tjek i rækkefølge:

1. Har PR'et label'en `dev`? Præcis den stavemåde, med småt. Uden den sker
   der intet.
2. Kørte `dev.yml` og lagde et image op? Se _Actions_, og _Packages_ på
   repoet. Husk at workflowet afbrydes, hvis et andet PR gør krav på miljøet
   imens — det er meningen, men det ligner en fejl i Actions.
3. Har agenten set det? På Pi'en: `journalctl -u maanslogen-agent -n 50`.
   Den skriver `dev: label sat, men intet :dev-image endnu — bliver på main`,
   hvis den kom først.
4. Hvilket image kører den? `docker inspect --format '{{.Config.Image}}'
maanslogen-api-dev`. Står der `:main`, har agenten ikke set label'en.

**Dev svarer 502.** Caddy fandt ikke containeren.
`docker ps | grep api-dev` og `docker logs maanslogen-api-dev`. Oftest gik den
ned ved opstart på en manglende variabel i `/etc/maanslogen/pi.env`.

**Dev svarer 404 med "ukendt vært".** Caddy kender ikke værtsnavnet.
`PROD_API_HOST`/`DEV_API_HOST` passer ikke med DNS.

**Web-siden kan ikke kalde API'et (CORS).** Dev-sidens adresse er fast
(`https://dev-<worker>.<subdomæne>.workers.dev`), men den skal stå i
`DEV_CORS_ORIGINS` på Pi'en. Det var netop den liste der skulle følge med fra
PR til PR, dengang hver preview havde sin egen adresse.

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
