# Maanslogen 2.0

Anmeldelser af drikkevarer — øl, vin, whisky, gin, rom og cider — bygget på én idé:

> En øl og en vin skal ikke beskrives med de samme felter, og de skal ikke besvare
> de samme spørgsmål.

Derfor er både **egenskaber** og **anmeldelsesspørgsmål** data frem for kode. De
redigeres i admin, og hverken en udrulning eller en datamigrering er nødvendig for
at tilføje et nyt felt.

Det er samme princip som i [1.0](https://github.com/Mfoldager17/maanslogen) — alt
andet er skrevet om.

---

## Indhold

- [Kom i gang](#kom-i-gang)
- [Hvad består det af](#hvad-består-det-af)
- [Domænemodellen](#domænemodellen)
- [Hvorfor det er skrevet om](#hvorfor-det-er-skrevet-om)
- [Kommandoer](#kommandoer)
- [Test](#test)
- [Miljøer og udrulning](#miljøer-og-udrulning)
- [Dokumentation](#dokumentation)

---

## Kom i gang

Forudsætninger: **Node 22+**, **pnpm 10+** og **Docker** (til Postgres og S3).

```bash
pnpm install

# Postgres på 5432 og en S3-server på 9000
pnpm infra:up

cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

pnpm db:migrate     # opretter skemaet
pnpm db:seed        # 620 drikkevarer, 160 brugere, ~9.100 anmeldelser (~12 sek)

pnpm dev            # API på :4000, web på :3000
```

Log ind med en af de seedede konti:

| E-mail                | Adgangskode          | Rolle     |
| --------------------- | -------------------- | --------- |
| `admin@maanslogen.dk` | `Maanslogen-Admin-1` | ADMIN     |
| `mod@maanslogen.dk`   | `Maanslogen-Mod-1`   | MODERATOR |
| `jonas@example.dk`    | `Maanslogen-Test-1`  | USER      |

- Sitet: <http://localhost:3000>
- Admin: <http://localhost:3000/admin>
- API-dokumentation: <http://localhost:4000/docs>

---

## Hvad består det af

```
maanslogen-2.0/
├── apps/
│   ├── api/          NestJS 12 · Fastify · Prisma 7 · PostgreSQL 17
│   └── web/          Next.js 16 · React 19 · Tailwind v4 — site og admin i én app
├── packages/
│   ├── contracts/    Zod-skemaer: én kilde til sandhed for API og web
│   └── tsconfig/     Delte TypeScript-konfigurationer
└── docker/           Postgres + S3-server til udvikling
```

### `packages/contracts` er omdrejningspunktet

Hvert skema bruges tre steder:

1. **API'et validerer input** med det (`ZodValidationPipe`).
2. **API'ets OpenAPI-dokument** genereres fra det (`z.toJSONSchema`).
3. **Frontend validerer formularen** med det, og udleder sine typer fra det.

Det betyder, at adgangskodekravene, grænserne for en attributværdi og reglen om
halve stjerner findes præcis ét sted. En ændring kan ikke glemmes i det ene lag.

```ts
// packages/contracts/src/review.ts
export const ratingSchema = z
  .number()
  .min(1)
  .max(5)
  .refine((value) => Number.isInteger(value / 0.5), {
    message: "Bedømmelsen skal være i halve stjerner (1, 1.5, 2 …)",
  });
```

---

## Domænemodellen

```
BeverageCategory ──< BeverageType ──< Beverage >── Brand
     (Øl)              (Stout)      (Beer Geek)    (Mikkeller)
       │                   │            │
       │                   │            ├──< BeverageAttributeValue >── AttributeDefinition
       │                   │            └──< Review >── ReviewAnswer >── Question
       │                   │                              │
       └───── AttributeDefinition og Question kan målrettes ┘
              en kategori, en type, eller ingen af delene
```

**AttributeDefinition** beskriver hvad en drikkevare _kan_ have: nøgle, datatype,
enhed, valideringsregler og hvilke kategorier og typer den gælder for. En tom
relation betyder "gælder alle".

**Question** gør det samme for anmeldelser. Spørgsmålet _"Hvor bitter er den?"_
stilles kun for øl; _"Ville du købe den igen?"_ stilles for alt.

Svarene gemmes **typet** — et tal i `value_number`, ikke en streng — og det er
grunden til at 200 anmelderes svar kan blive til én smagsprofil på drikkevarens
side.

> Detaljer, regler og begrundelser: [`docs/domain-model.md`](docs/domain-model.md)

---

## Hvorfor det er skrevet om

1.0 havde en god idé og en implementering der ikke bar den. Det væsentlige:

|                      | 1.0                                                                                                   | 2.0                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Autentificering**  | Fandtes ikke. Hele admin-API'et lå åbent.                                                             | argon2id, JWT med tokenVersion-tjek, rullende refresh-tokens med tyveridetektion, rollestyring            |
| **Validering**       | DTO'er med class-validator, men `ValidationPipe` blev aldrig registreret — intet input blev valideret | Zod-skemaer delt med frontend, håndhævet på hvert kald                                                    |
| **Filtrering**       | Alle drikkevarer blev hentet og filtreret i browseren                                                 | Filtrering, søgning, sortering og facettællinger i databasen                                              |
| **Paginering**       | Ingen                                                                                                 | Cursor-paginering hele vejen igennem                                                                      |
| **Fejl**             | Tre forskellige formater afhængigt af hvor fejlen opstod                                              | RFC 9457 Problem Details, ét format                                                                       |
| **Typer i frontend** | Genereret klient checket ind i repoet, drev fra API'et, nogle endpoints håndkodet udenom              | Typerne udledes af de delte skemaer; ingen kodegenerering                                                 |
| **Bedømmelser**      | Gennemsnittet blev justeret ad hoc og kunne drive fra anmeldelserne                                   | Genberegnes fra rækkerne i samme transaktion                                                              |
| **Objektlager**      | Selvhostet MinIO. Et cron-job listede alle buckets og slettede de tomme                               | Cloudflare R2 i produktion, Alarik lokalt, samme kode. Oprydning rører kun nøgler API'et selv har udstedt |
| **Kategori-ikoner**  | Gemt som en `Image`-række med emojien i `url`-feltet                                                  | Et `icon`-felt                                                                                            |
| **Billeder**         | Hver størrelse var en løsrevet række uden sammenhæng                                                  | `MediaAsset` med `MediaRendition`-varianter og alt-tekst                                                  |
| **Controllere**      | Parallelle `admin/`- og `web/`-controllere med hver sit DTO-sæt for samme data                        | Ét sæt endpoints; læsning offentlig, skrivning rollebeskyttet                                             |
| **Test**             | Ingen                                                                                                 | 132: kontrakter, unit og e2e mod en rigtig Postgres                                                       |

> Det fulde regnskab: [`docs/architecture.md`](docs/architecture.md)

---

## Kommandoer

Fra repoets rod:

| Kommando                        | Gør                                                       |
| ------------------------------- | --------------------------------------------------------- |
| `pnpm dev`                      | Kører API og web med hot reload                           |
| `pnpm dev:web`                  | Kun web — mod dev-miljøet hvis `.env.local` peger dertil  |
| `pnpm dev:api`                  | Kun API'et                                                |
| `pnpm build`                    | Bygger alt                                                |
| `pnpm test`                     | Unit-tests i alle pakker                                  |
| `pnpm lint` / `pnpm typecheck`  | ESLint / `tsc --noEmit`                                   |
| `pnpm format`                   | Prettier                                                  |
| `pnpm db:migrate`               | Ny migrering ud fra schema-ændringer                      |
| `pnpm db:seed`                  | Seeder 620 drikkevarer og ~9.100 anmeldelser (idempotent) |
| `SEED_SCALE=lille pnpm db:seed` | Kun de 17 håndskrevne — hurtigt                           |
| `pnpm db:studio`                | Prisma Studio                                             |
| `pnpm infra:up` / `infra:down`  | Postgres og S3-serveren                                   |

I `apps/api`:

| Kommando              | Gør                                                   |
| --------------------- | ----------------------------------------------------- |
| `pnpm test:e2e`       | E2E mod databasen i `TEST_DATABASE_URL`               |
| `pnpm db:deploy`      | Kører migreringer uden at ændre schemaet (produktion) |
| `pnpm openapi:export` | Skriver `openapi.json` uden at starte en server       |

---

## Test

```bash
pnpm test                        # 65 unit-tests: kontrakter, API og web
pnpm --filter @maanslogen/api test:e2e   # 67 e2e mod en rigtig Postgres
```

E2E-testene kører mod en rigtig database — ikke mocks. Det er netop
transaktionerne, constraint'ene og Prisma-forespørgslerne der skal bevises:

```bash
createdb maanslogen_test
cd apps/api
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/maanslogen_test" pnpm exec prisma migrate deploy
pnpm test:e2e
```

Testene dækker blandt andet at et genbrugt refresh-token invaliderer hele
familien, at en attributværdi uden for sine grænser ruller hele oprettelsen
tilbage, og at drikkevarens gennemsnit altid stemmer med anmeldelsesrækkerne.

---

## Miljøer og udrulning

To miljøer. **Produktion** kører altid: web som en Cloudflare Worker, API og
Postgres på en Raspberry Pi bag en Cloudflare Tunnel. **Dev** opstår når et PR
åbnes og forsvinder når det lukkes — en Worker-version og en API-container pr.
PR, alle mod den samme dev-database med testdata.

```bash
# Web til Workers
cd apps/web && NEXT_PUBLIC_API_URL=https://api.maanslogen.dk pnpm cf:deploy

# API'et som image
docker build -f apps/api/Dockerfile -t maanslogen-api .
```

Konfigurationen valideres ved opstart — mangler en nøgle, starter processen
ikke, i stedet for at fejle først når nogen rammer et endpoint.

Alt i Cloudflare der ikke ændrer sig — buckets, tunnel, faste DNS-navne,
cache-reglen — ligger som Terraform i [`infra/terraform/`](infra/terraform/).
Det der kommer og går pr. PR gør ikke, og hvorfor står samme sted.

> Opsætning trin for trin: [`docs/environments.md`](docs/environments.md)

---

## Dokumentation

| Dokument                                             | Handler om                                              |
| ---------------------------------------------------- | ------------------------------------------------------- |
| [`docs/architecture.md`](docs/architecture.md)       | Valgene bag API'et og frontend, og hvad de erstatter    |
| [`docs/domain-model.md`](docs/domain-model.md)       | Datamodellen, felt for felt, og reglerne bag            |
| [`docs/api.md`](docs/api.md)                         | Endpoints, paginering, filtrering og fejlformat         |
| [`docs/environments.md`](docs/environments.md)       | Dev og produktion, PR-previews og opsætningen af det    |
| [`docs/deployment.md`](docs/deployment.md)           | Cloudflare R2, miljøvariabler og udrulning              |
| [`docs/r2-omkostninger.md`](docs/r2-omkostninger.md) | Hvordan R2-forbruget holdes inden for det gratis niveau |
