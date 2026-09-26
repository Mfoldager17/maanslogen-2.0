# Domænemodel

Systemet handler om at anmelde drikkevarer, hvor _hvad der kan beskrives_ og
_hvad der bliver spurgt om_ er data frem for kode.

```
BeverageCategory ──< BeverageType ──< Beverage >── Brand
     (Øl)              (Stout)      (Beer Geek)    (Mikkeller)
                                        │
                                        ├──< BeverageAttributeValue >── AttributeDefinition
                                        └──< Review >── ReviewAnswer >── Question
```

Alle tabeller er navngivet i snake_case i databasen (`@@map`), så SQL uden for
Prisma er behageligt at skrive.

---

## Katalogets tre niveauer

### BeverageCategory

Øverste niveau: Øl, Vin, Whisky, Gin, Rom, Cider.

| Felt          | Type     | Note                                                                                |
| ------------- | -------- | ----------------------------------------------------------------------------------- |
| `slug`        | unik     | URL-navnet, fx `oel`                                                                |
| `name`        |          |                                                                                     |
| `icon`        | nullable | En emoji. I 1.0 blev dette misbrugt som en `Image`-række med emojien i `url`-feltet |
| `accentColor` | nullable | Hex                                                                                 |
| `sortOrder`   |          | Rækkefølgen i menuer                                                                |
| `active`      |          | Skjuler den fra sitet uden at slette                                                |
| `deletedAt`   | nullable | Blød sletning                                                                       |

En kategori kan ikke arkiveres, så længe den har aktive typer. API'et svarer 409.

### BeverageType

Niveauet under: Stout, IPA, Rødvin, Bourbon.

Unik på `(categoryId, name)` — to typer i samme kategori kan ikke hedde det
samme, men "Rosé" må gerne findes under både Vin og Cider.

### Brand

Bryggeriet, vinhuset eller destilleriet. Har en mange-til-mange-relation til
kategorier, som begrænser hvor mærket kan bruges: vælger man kategorien Vin i
drikkevareformularen, vises Mikkeller ikke.

### Beverage

Den konkrete flaske.

| Felt                                            | Note                                                         |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `slug`                                          | Unik. Bygges af mærke + navn + årgang                        |
| `vintage`                                       | Nullable. Relevant for vin og whisky                         |
| `countryCode`                                   | `CHAR(2)`, altid versaler (håndhævet af en CHECK-constraint) |
| `ratingAverage`, `ratingCount`, `ratingBuckets` | Denormaliseret — se nedenfor                                 |

Unik på `(brandId, name, vintage)`, så samme vin må findes i flere årgange, men
ikke to gange i samme.

---

## Dynamiske attributter

### AttributeDefinition

Beskriver hvad en drikkevare _kan_ have.

| Felt          | Note                                                                  |
| ------------- | --------------------------------------------------------------------- |
| `key`         | snake_case, unik, **kan ikke ændres** — den binder alle gemte værdier |
| `dataType`    | `TEXT`, `NUMBER`, `BOOLEAN`, `ENUM`, `MULTI_ENUM`                     |
| `unit`        | `%`, `IBU`, `år` … Fandtes ikke i 1.0                                 |
| `required`    | Skal udfyldes for at gemme drikkevaren                                |
| `filterable`  | Vises som facetfilter i kataloget                                     |
| `highlighted` | Vises på drikkevarekortet                                             |
| `rules`       | JSON: `{ min, max, step, minLength, maxLength, pattern }`             |
| `options`     | JSON: `[{ value, label }]` for ENUM og MULTI_ENUM                     |
| `categories`  | m2m. **Tom = gælder alle kategorier**                                 |
| `types`       | m2m. **Tom = gælder alle typer i de valgte kategorier**               |

Reglen om tomme relationer er 1.0's `typeId = NULL`-idé, men eksplicit og uden
nullable-gætteri. Den evalueres i databasen:

```ts
AND: [
  { OR: [{ categories: { none: {} } }, { categories: { some: { id: categoryId } } }] },
  { OR: [{ types: { none: {} } }, { types: { some: { id: typeId } } }] },
];
```

Datatypen kan heller ikke ændres efter oprettelse: værdierne ligger i
typebestemte kolonner, og en ændring ville efterlade dem uvidende om hvilken
kolonne de hører til.

### BeverageAttributeValue

Én række pr. (drikkevare, definition). Præcis ét `value*`-felt er udfyldt,
bestemt af definitionens `dataType`:

| dataType       | Kolonne                             |
| -------------- | ----------------------------------- |
| `TEXT`, `ENUM` | `value_text`                        |
| `NUMBER`       | `value_number`                      |
| `BOOLEAN`      | `value_boolean`                     |
| `MULTI_ENUM`   | `value_json` (liste af enum-nøgler) |

Indekseret som `(definitionId, value_text)`, `(definitionId, value_number)` og
`(definitionId, value_boolean)`, så facetfiltrering er hurtig.

**JSON-null vs SQL-null:** Prisma skelner. Vi skriver altid `Prisma.DbNull`, så
en tom kolonne er SQL NULL og ikke JSON-værdien `null`.

**Validering** sker med den delte funktion `validateAttributeValue()` — samme kode
i formularen og i API'et — inde i den transaktion der gemmer drikkevaren. En
ugyldig værdi ruller hele oprettelsen tilbage.

Skifter en drikkevare type, fjernes de værdier der ikke længere gælder, i samme
transaktion.

---

## Anmeldelser

### Question

Samme mønster som `AttributeDefinition`, men for anmeldelser.

| `answerType`   | Gemmes i        | Vises som                             |
| -------------- | --------------- | ------------------------------------- |
| `TEXT`         | `value_text`    | Tekstfelt                             |
| `NUMBER`       | `value_number`  | Talfelt                               |
| `BOOLEAN`      | `value_boolean` | Ja/nej-knapper                        |
| `SCALE`        | `value_number`  | Knapper 1–5 med etiketter i hver ende |
| `SELECT`       | `value_text`    | Dropdown                              |
| `MULTI_SELECT` | `value_json`    | Multivalg-chips                       |

`scale` holder `{ min, max, minLabel, maxLabel }`.

Et spørgsmål med besvarelser bliver **arkiveret** frem for slettet. Ellers ville
gamle anmeldelser miste den kontekst de blev skrevet i.

### Review

| Felt                  | Note                                                         |
| --------------------- | ------------------------------------------------------------ |
| `rating`              | 1–5 i halve trin. Håndhævet af CHECK-constraints i databasen |
| `title`, `body`       | Valgfri                                                      |
| `userId + beverageId` | Unik — én anmeldelse pr. bruger pr. drikkevare               |

Constraint'erne ligger i databasen, ikke kun i koden:

```sql
CHECK (rating >= 1 AND rating <= 5)
CHECK ((rating * 2) = floor(rating * 2))   -- kun halve trin
```

### Bedømmelsen genberegnes, den justeres ikke

`Beverage.ratingAverage`, `ratingCount` og `ratingBuckets` er denormaliserede, så
lister kan sortere på dem. De bliver **genberegnet fra rækkerne** i samme
transaktion som den anmeldelse der udløste ændringen:

```ts
await this.prisma.$transaction(async (tx) => {
  await tx.review.create({ ... });
  await this.recomputeRating(tx, beverageId);   // GROUP BY rating
});
```

1.0 lagde til og trak fra i gennemsnittet ved hver ændring. Én fejlet opdatering,
og tallet drev fra virkeligheden uden mulighed for at opdage det. En e2e-test
sammenligner nu det gemte gennemsnit med summen af rækkerne.

### Smagsprofilen

Fordi svarene gemmes typet — et tal i `value_number`, ikke en streng — kan
`GET /reviews/profile/:idOrSlug` sammenfatte dem:

- **SCALE** og **NUMBER** → gennemsnit
- **BOOLEAN** → andel der svarede ja
- **SELECT** og **MULTI_SELECT** → fordeling pr. valgmulighed
- **TEXT** → udelades; fritekst kan ikke aggregeres meningsfuldt

Det er hele udbyttet af den dynamiske model: "88 % ville købe den igen" er ikke
et felt nogen har oprettet, men en konsekvens af et spørgsmål nogen stillede.

---

## Medier

### MediaAsset og MediaRendition

Ét logisk billede med flere renditions:

```
MediaAsset (id, ownerType, alt, blurhash)
   └── MediaRendition (variant, storageKey, width, height, bytes)
```

Varianterne er `THUMB` (200²), `CARD` (600²), `FULL` (1200²) og `AVATAR` (256²).
Hvilke der genereres afhænger af ejer-typen.

1.0 havde en flad `Image`-tabel, hvor hver størrelse var sin egen række uden
nogen sammenhæng — man kunne ikke se hvilken thumbnail der hørte til hvilket
stort billede. Og der var ingen alt-tekst.

### PendingUpload

Nøgler der har fået en presigned URL, men endnu ikke er knyttet til et asset.
Bliver de ikke gjort krav på inden for `PENDING_UPLOAD_TTL_MINUTES`, sletter
oprydningsjobbet både objektet og rækken.

Samme tabel bruges når et asset fjernes: nøglerne får en frist frem for at blive
slettet med det samme, så sletningen ikke blokerer svaret.

---

## Brugere

| Felt                  | Note                                                    |
| --------------------- | ------------------------------------------------------- |
| `passwordHash`        | argon2id                                                |
| `role`                | `USER`, `MODERATOR`, `ADMIN` — hierarkisk               |
| `tokenVersion`        | Bumpes ved adgangskodeskift, rolleskift og deaktivering |
| `active`, `deletedAt` | Deaktivering frem for hård sletning                     |

En bruger kan ikke ændre sin egen rolle eller deaktivere sig selv. Det er den
hurtigste vej til at låse sig ude af sit eget system.

`RefreshToken` gemmer kun en SHA-256-hash, har et `familyId` pr. login, og
markeres `rotatedAt` når den byttes. Dukker et roteret token op igen, invalideres
hele familien.

---

## Bløde sletninger

Katalogdata (`Category`, `Type`, `Brand`, `Beverage`, `AttributeDefinition`,
`Question`) har `deletedAt`. Hård sletning ville efterlade anmeldelser
forældreløse eller kræve at de blev slettet med — og en anmeldelse er brugerens
indhold, ikke vores.

Undtagelsen er `Review.remove()`, som sletter hårdt: en anmeldelse der skal væk,
skal ikke ligge og tælle med i gennemsnittet, og unikhedskravet
(bruger, drikkevare) skal frigives, så man kan skrive en ny.

---

## Constraints i databasen

Prisma kan ikke udtrykke CHECK-constraints i `schema.prisma`, så de ligger i en
migrering. Invarianter der gælder altid, hører hjemme i databasen — ikke kun i den
applikation der tilfældigvis skriver i dag:

```sql
-- Bedømmelser i halve trin mellem 1 og 5
CHECK (rating >= 1 AND rating <= 5)
CHECK ((rating * 2) = floor(rating * 2))

-- Det denormaliserede gennemsnit kan ikke komme uden for skalaen
CHECK (rating_average >= 0 AND rating_average <= 5)

-- Landekoder i versaler, så sammenligninger er forudsigelige
CHECK (country_code IS NULL OR country_code = upper(country_code))

-- Slugs og attributnøgler har et format
CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
CHECK (key ~ '^[a-z][a-z0-9_]*$')
```

Samme migrering opretter `pg_trgm` og GIN-indekser, så fritekstsøgning med
`ILIKE '%term%'` er hurtig uden en separat søgemaskine.
