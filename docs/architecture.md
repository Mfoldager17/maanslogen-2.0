# Arkitektur

Dette dokument forklarer _hvorfor_ 2.0 ser ud som den gør. Hvert valg er sat op
mod hvad 1.0 gjorde, fordi det er den bedste måde at forklare hvad der blev
vundet.

---

## Oversigt

```
                          ┌──────────────────────────┐
   browser ───────────────│  Next.js 16 (apps/web)   │
                          │  site + admin i én app   │
                          └───────────┬──────────────┘
                                      │ HTTP + httpOnly-cookies
                          ┌───────────▼──────────────┐
                          │  NestJS 12 (apps/api)    │
                          │  Fastify · Zod · Prisma  │
                          └────┬─────────────────┬───┘
                               │                 │
                      ┌────────▼──────┐   ┌──────▼────────────┐
                      │ PostgreSQL 17 │   │ Cloudflare R2     │
                      │               │   │ (LocalStack lokalt)│
                      └───────────────┘   └───────────────────┘

                    packages/contracts (Zod) bruges af begge
```

---

## Ét sted til sandheden: `packages/contracts`

**1.0:** DTO-klasser med `class-validator`-dekoratorer i API'et, en separat
Swagger-beskrivelse på controllerne, og en genereret TypeScript-klient checket ind
i frontend. Tre beskrivelser af den samme form. De drev fra hinanden — og
`api-client.ts` havde en håndskreven funktion udenom den genererede klient, fordi
genereringen ikke var kørt siden endpointet blev tilføjet.

**2.0:** Ét Zod-skema pr. form. Det bruges til:

| Formål                  | Hvordan                                             |
| ----------------------- | --------------------------------------------------- |
| Validering i API'et     | `ZodValidationPipe`                                 |
| OpenAPI-dokumentet      | `z.toJSONSchema(schema, { target: 'openapi-3.0' })` |
| Typer i frontend        | `z.infer<typeof schema>`                            |
| Validering i formularen | Samme skema, kaldt i browseren                      |

Delte hjælpefunktioner bor samme sted, og det giver en behagelig egenskab:
API'et og frontend _formaterer_ en attributværdi med nøjagtig samme funktion, så
"7,5 %" ser ens ud begge steder.

```ts
// Bruges af serveren når den svarer, og af browseren når den viser en forhåndsvisning
export function formatAttributeValue(definition, value): string;
```

### Query-parametre der faktisk virker

`z.coerce.boolean()` gør `"false"` til `true`, fordi en ikke-tom streng er
sandt-agtig. Det er en fælde man falder i én gang. Derfor har kontrakterne
egne hjælpere:

```ts
optionalBoolean(); // "false" → false, "" → undefined
booleanWithDefault(false); // udeladt → false
intWithDefault({ min: 1, max: 100, default: 24 });
```

Og de findes i to udgaver — med og uden standardværdi — så den udledte type
bliver `number` frem for `number | undefined`, når der _er_ en standardværdi.

---

## API'et

### Fastify frem for Express

Nest kører på Fastify. Det er hurtigere, men den konkrete grund var
`querystringParser`: kataloget har brug for `attr[alcohol_percent]=5..9`, og
standardparseren afleverer det som én flad nøgle. Uden en `qs`-parser gjorde
attributfiltrene **stiltiende ingenting** — forespørgslen lykkedes, den
returnerede bare alt.

```ts
routerOptions: {
  querystringParser: (search) => qs.parse(search, { depth: 2, parameterLimit: 100 }),
}
```

`depth: 2` er nok til `attr[nøgle]` og holder dybt indlejrede input ude.

### Ingen global ValidationPipe

Der er **ingen** `class-validator`. Al validering går gennem `ZodValidationPipe`
med de delte skemaer. To valideringssystemer side om side betyder to steder at
glemme en regel.

(1.0 havde class-validator-dekoratorer overalt, men registrerede aldrig en
`ValidationPipe` i `main.ts`. Dekoratorerne var dekoration.)

### Fejl: RFC 9457 Problem Details

Ét fejlformat for hele API'et:

```json
{
  "type": "https://maanslogen.dk/problems/validation-failed",
  "title": "Validering fejlede",
  "status": 422,
  "detail": "Et eller flere felter er ugyldige",
  "errors": { "key": ["Nøglen skal være snake_case, fx \"alcohol_percent\""] },
  "instance": "/api/v1/attributes",
  "requestId": "a61cd7bf-23f5-4ad0-8ee7-8c950aeed0dd"
}
```

`errors` mapper direkte til feltfejl i formularen. `requestId` matcher
`x-request-id` i svaret og i logfilen.

### Cursor-paginering

Alle lister bruger cursors, ikke offsets. Offset-paginering springer rækker over
eller viser dubletter, når nogen opretter noget mens man bladrer — og det gør
nogen hele tiden i et admin-panel.

```ts
// Henter limit + 1 for at vide om der er flere, uden en ekstra tælling
const rows = await fetch(limit + 1, cursorId);
const hasMore = rows.length > limit;
```

`total` udregnes kun når klienten beder om det (`withTotal=true`), fordi en
`COUNT(*)` over et filtreret sæt ikke er gratis.

Sorteringen har altid `id` som sekundær nøgle, så to rækker med samme bedømmelse
ikke kan bytte plads mellem to sider.

### Ét sæt controllere

1.0 havde `admin/`- og `web/`-controllere med hver sit DTO-sæt for de samme
data — dobbelt kode, og to steder at glemme en ændring.

2.0 har ét sæt: læsning er `@Public()`, skrivning kræver `@MinRole('MODERATOR')`.
Standarden er lukket: `JwtAuthGuard` er registreret globalt, så et endpoint uden
`@Public()` kræver login, selv hvis nogen glemmer at tænke over det.

### Opslag på id eller slug

```ts
export function idOrSlugWhere(value: string) {
  return isUuid(value) ? { id: value } : { slug: value };
}
```

Det ser overflødigt ud indtil man prøver `OR: [{ id }, { slug }]` med en slug:
`id` er en `uuid`-kolonne, og Postgres fejler på castet, før den overhovedet
kigger på slug'en. Resultatet er 500 i stedet for 404 — og det ramte hvert
eneste detaljeopslag, indtil en test fangede det.

---

## Autentificering

1.0 havde en `User`-tabel med `passwordHash` og ingen kode der brugte den.
Seed-dataene indeholdt `passwordHash: 'hashedpassword1'`. Hele admin-API'et lå
åbent på internettet.

2.0:

- **argon2id** med bevidst satte parametre (19 MiB, 2 iterationer).
- **Access-tokens** (JWT, 15 min) bærer `sub`, `email`, `role` og `ver`.
- **`ver` tjekkes mod databasen** ved hvert autentificeret kald. Uden det opslag
  ville et rolleskift eller en deaktivering først slå igennem, når tokenet
  tilfældigvis udløb. Prisen er ét primærnøgle-opslag pr. kald.
- **Rollen læses fra databasen**, ikke fra tokenet, så en degradering virker med
  det samme.
- **Refresh-tokens** er tilfældige strenge (ikke JWT'er), og kun deres SHA-256-hash
  gemmes. Hvert token kan bruges én gang.
- **Tyveridetektion:** dukker et allerede brugt refresh-token op igen, er det
  lækket. Hele familien invalideres, så både tyv og offer skal logge ind igen.
- **Timing:** login verificerer altid mod en hash, også når brugeren ikke findes,
  så svartiden ikke afslører hvilke e-mails der er oprettet.

Tokens sendes som `httpOnly`-cookies, så de aldrig findes i JavaScript og ikke kan
læses af et XSS-fund. Andre klienter kan bruge `tokens` i svaret direkte.

### Tre lag i frontend

1. **Middleware** kører før noget renderes. Den fornyer en udløbet session med
   refresh-tokenet og afviser folk uden adgang.
2. **Layoutet** henter brugeren og tjekker rollen igen.
3. **API'et** håndhæver det hele ved hvert kald.

Kun det sidste lag beskytter data. De to første findes, fordi et `redirect()` i
et layout ikke er nok: layout og page renderer sideløbende i App Router, så
sidens indhold kan nå at blive streamet, før layoutet afviser adgangen.

Middleware læser rollen ud af JWT-payloaden **uden** at verificere signaturen.
Det er bevidst — så skal web-appen ikke dele API'ets hemmelighed — og et
forfalsket token kommer ingen vegne, fordi API'et afviser det.

---

## Objektlager

**1.0:** MinIO, selvhostet. Servicen kunne oprette buckets, sætte bucket-policies
og slette buckets. Et cron-job kørte hver søndag, listede _alle_ buckets og
slettede dem der var tomme — med ét hårdkodet navn som eneste beskyttelse.

**2.0:** `StorageService` kan ikke oprette eller slette buckets. Den kan udstede
presignede PUT-URL'er, læse et objekts størrelse og slette **navngivne nøgler**.
Ikke præfikser, ikke buckets.

Nøglen dannes altid i backenden:

```
beverage/2026/09/<asset-uuid>/card.webp
```

Klienten kan hverken vælge bucket eller sti, så en manipuleret forespørgsel kan
ikke overskrive et andet objekt.

Produktionen kører på **Cloudflare R2**: ingen egress-omkostninger, indbygget CDN
og S3-kompatibel API. Lokalt kører LocalStack på samme API, så koden er identisk —
kun `STORAGE_DRIVER` og nøglerne skifter.

### Uploadforløbet

1. Klienten beder om presignede URL'er for de varianter den skal bruge.
2. API'et udsteder dem og registrerer hver nøgle som **afventende**.
3. Browseren skalerer billedet og uploader hver variant direkte til R2 —
   filerne rører aldrig vores egen server.
4. Klienten sender nøglerne med, når drikkevaren gemmes. Nøglerne bliver til et
   `MediaAsset` i **samme transaktion** som drikkevaren.
5. Nøgler der aldrig blev gjort krav på, ryddes op af et cron-job.

En presigned PUT kan ikke håndhæve en maksimal filstørrelse, så grænsen
kontrolleres når uploadet gøres krav på.

---

## Frontend

### Server-komponenter først

Sider henter data på serveren. Det betyder ingen indlæsnings-spinner for det
primære indhold, intet vandfald af forespørgsler, og at API-cookien aldrig når
browserens JavaScript.

Klient-komponenter bruges hvor der er interaktion: filtre, formularer,
tema-skifteren.

1.0 lagde alt i `useEffect` med håndrullede `{ data, error, loading }`-hooks.
`useBeverages.ts` var 300 linjer state, hvoraf en stor del håndterede at holde en
kopi af listen i klienten synkroniseret med serveren. 2.0 kalder
`router.refresh()` efter en skrivning og lader serveren svare — så kan kopien
ikke komme ud af trit.

### Filtrene kender ikke til øl

Filtersidebaren bygges af de attributdefinitioner der er markeret `filterable`
for den valgte kategori. Der er ingen `if (category === 'øl')` nogen steder.
Tilføjer man "Fadlagring" som filtrerbar attribut i admin, dukker filteret op af
sig selv — med en interval-kontrol hvis det er et tal, og afkrydsningsfelter hvis
det er et valg.

Det samme gælder anmeldelsesformularen og drikkevareformularen i admin.

### Designsystemet

Tokens er CSS-variabler. Mørkt tema skifter kun variablernes værdier, så ingen
komponent kender til temaer — der er ingen `dark:`-klasser spredt ud i markup'en.

```css
:root {
  --accent: #a8492a;
  --canvas: #fbf8f3;
}
.dark {
  --accent: #e08055;
  --canvas: #171310;
}
@theme {
  --color-accent: var(--accent);
}
```

Typografien er **Fraunces** til overskrifter og **Public Sans** til brødtekst.
Tal formateres med `Intl` på dansk: 7,5 % og 1.284 anmeldelser.

### Bevægelse

Der er små animationer knyttet til det drikkevarerne handler om: et glas der
fyldes op som indlæsningsindikator, et brus af bobler når man vælger en stjerne,
to glas der støder sammen når en anmeldelse er udgivet, og søjler der bevæger sig
som væske i smagsprofilen.

Alle er rene CSS-animationer, ingen af dem påvirker layoutet, og alle er slået
fra under `prefers-reduced-motion`.

---

## Tilgængelighed

Det er bygget ind frem for lagt ovenpå:

- `Field`-komponenten sætter altid `aria-describedby` og `aria-invalid` op, så et
  felt ikke kan ende med en fejl der kun ses visuelt.
- Bedømmelser har altid talværdien ved siden af stjernerne, og et `aria-label`
  der læser "4,5 ud af 5 stjerner baseret på 214 anmeldelser".
- Berøringsflader er mindst 44 px.
- Fokusmarkeringen er synlig, men kun for tastatur (`:focus-visible`).
- Farvekontrasten holder 4,5:1 for tekst i begge temaer.
- Stjernerne bruger en CSS-overlejring frem for `clipPath`-id'er, som ville
  kollidere hver gang to bedømmelser på samme side havde samme værdi.
