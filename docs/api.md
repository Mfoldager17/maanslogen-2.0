# API

Base: `/api/v1`. Interaktiv dokumentation på `/docs`, maskinlæsbar på
`/docs/openapi.json` — begge genereret fra de samme Zod-skemaer som validerer
input.

Versionering fra dag ét, så en breaking change kan udgives side om side i stedet
for at kræve at alle klienter opdaterer samtidig.

---

## Autentificering

Send enten en `Authorization: Bearer <access-token>`-header eller lad browseren
sende `mlg_at`-cookien.

| Endpoint                     | Gør                                          |
| ---------------------------- | -------------------------------------------- |
| `POST /auth/register`        | Opretter en konto og logger ind              |
| `POST /auth/login`           | Logger ind                                   |
| `POST /auth/refresh`         | Bytter et refresh-token til et nyt sæt       |
| `POST /auth/logout`          | Invaliderer refresh-familien                 |
| `GET /auth/me`               | Den indloggede bruger                        |
| `POST /auth/change-password` | Skifter adgangskode og dræber alle sessioner |

Svaret sætter `mlg_at` (15 min) og `mlg_rt` (30 dage) som `httpOnly`-cookies og
returnerer samtidig tokenerne i kroppen, så klienter uden cookiejar kan bruge dem.

**Refresh-tokens roterer.** Hvert token kan bruges én gang. Bruges et allerede
brugt token igen, betragtes det som tyveri, og hele familien invalideres.

### Roller

`USER` < `MODERATOR` < `ADMIN`, hierarkisk.

|                   | Kan                                                                                                                                   |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Alle (uden login) | Læse kataloget, kategorier, typer, mærker, attributter, spørgsmål og anmeldelser                                                      |
| `USER`            | Skrive, redigere og slette sine egne anmeldelser; uploade billeder                                                                    |
| `MODERATOR`       | Alt katalogindhold: oprette og redigere drikkevarer, kategorier, typer, mærker, attributter og spørgsmål; redigere andres anmeldelser |
| `ADMIN`           | Arkivere katalogdata og administrere brugere                                                                                          |

---

## Fejl

Alle fejl er RFC 9457 Problem Details med `Content-Type: application/problem+json`:

```json
{
  "type": "https://maanslogen.dk/problems/validation-failed",
  "title": "Validering fejlede",
  "status": 422,
  "detail": "En eller flere attributværdier er ugyldige",
  "errors": {
    "attributes.alcohol_percent": ["Alkohol må højst være 70"]
  },
  "instance": "/api/v1/beverages",
  "requestId": "a61cd7bf-23f5-4ad0-8ee7-8c950aeed0dd"
}
```

| Status    | `type`              |
| --------- | ------------------- |
| 400 / 422 | `validation-failed` |
| 401       | `unauthorized`      |
| 403       | `forbidden`         |
| 404       | `not-found`         |
| 409       | `conflict`          |
| 429       | `rate-limited`      |
| 500       | `internal-error`    |

`errors` har feltstien som nøgle, så den kan mappes direkte til formularfelter.
`requestId` matcher `x-request-id` i svaret og i serverloggen.

---

## Paginering

Alle lister returnerer samme form:

```json
{
  "items": [ … ],
  "pageInfo": { "nextCursor": "eyJpZCI6IjU2YmYiLi4u", "hasMore": true, "total": null }
}
```

| Parameter   | Standard | Note                                               |
| ----------- | -------- | -------------------------------------------------- |
| `limit`     | 24       | Maks 100                                           |
| `cursor`    |          | `pageInfo.nextCursor` fra forrige svar             |
| `withTotal` | `false`  | Sæt `true` for at få `total`. Koster en `COUNT(*)` |
| `order`     | `asc`    |                                                    |
| `q`         |          | Fritekstsøgning, tolkes pr. ressource              |

Cursoren er uigennemsigtig — konstruér den ikke selv.

---

## Katalog

Hver ressource har samme form: `GET` (liste), `GET /:idOrSlug`, `POST`,
`PATCH /:id`, `DELETE /:id`. Opslag virker med både UUID og slug.

| Ressource  | Sti           | Ekstra filtre                                                  |
| ---------- | ------------- | -------------------------------------------------------------- |
| Kategorier | `/categories` | `active`, `sort=sortOrder\|name\|createdAt`                    |
| Typer      | `/types`      | `categoryId`, `categorySlug`, `active`                         |
| Mærker     | `/brands`     | `categoryId`, `categoryIds`, `active`, `sort=…\|beverageCount` |

`DELETE` arkiverer (blød sletning) og afvises med 409, hvis noget stadig peger på
rækken.

---

## Drikkevarer

### `GET /beverages`

| Parameter             | Eksempel                                            |
| --------------------- | --------------------------------------------------- |
| `categorySlug`        | `oel`                                               |
| `typeIds`, `brandIds` | Komma-separeret                                     |
| `countryCodes`        | `DK,IE`                                             |
| `minRating`           | `4`                                                 |
| `sort`                | `rating`, `reviewCount`, `name`, `createdAt`        |
| `includeInactive`     | `true` — kun til admin. Standarden viser kun aktive |
| `attr[nøgle]`         | Se nedenfor                                         |

**Attributfiltre** bruger attributtens nøgle og tre formater:

| Format           | Betydning                      | Eksempel                     |
| ---------------- | ------------------------------ | ---------------------------- |
| `min..max`       | Interval (begge ender valgfri) | `attr[alcohol_percent]=5..9` |
| `a\|b`           | En af flere værdier            | `attr[color]=dark\|amber`    |
| `true` / `false` | Ja/nej                         | `attr[organic]=true`         |

Flere attributfiltre kombineres med OG:

```
GET /api/v1/beverages?categorySlug=oel&attr[alcohol_percent]=5..9&attr[color]=dark
```

Kun attributter markeret `filterable` kan bruges.

### `GET /beverages/facets`

Tager præcis de samme parametre og returnerer tællinger pr. kategori, type,
mærke og land for det filtrerede sæt — så sidebaren kan vise "Stout (48)" og
gråne de valg der ikke giver resultater.

### `GET /beverages/:idOrSlug`

Den fulde drikkevare med alle attributværdier. Hver værdi kommer både rå og
færdigformateret:

```json
{
  "definitionId": "…",
  "key": "alcohol_percent",
  "displayName": "Alkoholprocent",
  "dataType": "NUMBER",
  "unit": "%",
  "value": 7.5,
  "displayValue": "7,5 %"
}
```

`displayValue` formateres med den samme funktion frontend bruger, så de to ikke
kan vise det samme tal forskelligt.

---

## Attributter og spørgsmål

| Endpoint                           | Gør                                                              |
| ---------------------------------- | ---------------------------------------------------------------- |
| `GET /attributes`                  | Liste. Filtre: `categoryId`, `typeId`, `dataTypes`, `filterable` |
| `GET /attributes/for-type/:typeId` | **Alle attributter der gælder for en type**                      |
| `GET /questions/for-type/:typeId`  | De spørgsmål der stilles for en type                             |

De to `for-type`-endpoints er dem frontend bygger formularer og filtre af. De
evaluerer reglen om tomme kategori- og type-relationer i databasen.

`key` og `dataType` kan ikke ændres på en attribut efter oprettelse, og
`answerType` kan ikke ændres på et spørgsmål: de bestemmer hvilken kolonne
værdierne ligger i.

Fjerner man en enum-valgmulighed der er i brug, svarer API'et 409 med hvilke
værdier der blokerer.

---

## Anmeldelser

| Endpoint                                 | Gør                                                             |
| ---------------------------------------- | --------------------------------------------------------------- |
| `GET /reviews`                           | Liste. Filtre: `beverageId`, `userId`, `minRating`, `maxRating` |
| `GET /reviews/form/:beverageIdOrSlug`    | Spørgsmålene for drikkevaren + brugerens egen anmeldelse        |
| `GET /reviews/profile/:beverageIdOrSlug` | Smagsprofil: svarene sammenfattet                               |
| `POST /reviews`                          | Skriv en anmeldelse                                             |
| `PATCH /reviews/:id`                     | Redigér — din egen, eller enhver som `MODERATOR`                |
| `DELETE /reviews/:id`                    | Slet                                                            |

`POST /reviews`:

```json
{
  "beverageId": "…",
  "rating": 4.5,
  "title": "Kaffen bærer den hele vejen",
  "body": "Tyk, mørk og ristet uden at blive klistret.",
  "answers": [
    { "questionId": "…", "value": 4 },
    { "questionId": "…", "value": true },
    { "questionId": "…", "value": ["coffee", "caramel"] }
  ]
}
```

`rating` skal være i halve trin mellem 1 og 5. Påkrævede spørgsmål skal besvares,
og et spørgsmål der ikke gælder for drikkevarens type afvises. Én anmeldelse pr.
bruger pr. drikkevare — ellers 409 med en opfordring til at redigere den
eksisterende.

Drikkevarens gennemsnit genberegnes i samme transaktion.

---

## Medier

`POST /media/presign` udsteder presignede PUT-URL'er:

```json
{ "ownerType": "BEVERAGE", "variants": ["THUMB", "CARD", "FULL"], "contentType": "image/webp" }
```

Svaret indeholder en `uploadUrl`, en `storageKey` og de mål varianten skal have.
Klienten skalerer selv, uploader hver variant med `PUT` direkte til
objektlageret, og sender bagefter nøglerne med når entiteten gemmes:

```json
{
  "name": "Beer Geek Breakfast",
  "media": {
    "alt": "Mørk flaske med gul etiket",
    "renditions": [
      {
        "variant": "CARD",
        "storageKey": "beverage/2026/09/…/card.webp",
        "width": 600,
        "height": 600
      }
    ]
  }
}
```

Bucket og nøgle bestemmes af backenden — klienten kan ikke vælge hvor filen
lander. Nøgler der aldrig gøres krav på, ryddes op af et cron-job.

---

## Drift

| Endpoint            | Gør                                        |
| ------------------- | ------------------------------------------ |
| `GET /health/live`  | Svarer processen?                          |
| `GET /health/ready` | Kan vi betjene trafik? (tjekker databasen) |

Rate limiting er som standard 120 forespørgsler pr. minut pr. IP og svarer 429
med et Problem Details-objekt.
