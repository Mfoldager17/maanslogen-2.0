# R2 uden regning

Målet er at blive inden for R2's gratis niveau så længe som muligt. Den korte
version: **Class A er ikke noget problem, Class B afgøres af én Cloudflare-
indstilling**, og resten er detaljer.

---

## Hvad koster hvad

R2's gratis niveau pr. måned:

|             | Gratis     | Hvad tæller                                                         |
| ----------- | ---------- | ------------------------------------------------------------------- |
| **Lagring** | 10 GB      | Hvor meget der ligger                                               |
| **Class A** | 1.000.000  | Skrivninger: `PutObject`, `DeleteObjects`, `ListObjects`, multipart |
| **Class B** | 10.000.000 | Læsninger: `GetObject`, `HeadObject`                                |
| **Egress**  | Ubegrænset | Båndbredde ud — gratis, og det er hele pointen med R2               |

Tallene bør bekræftes på [Cloudflares prisside](https://developers.cloudflare.com/r2/pricing/),
da de kan ændre sig.

**Det afgørende:** et cache-hit på Cloudflares kant er _ikke_ en R2-operation.
Filen bliver serveret fra kanten, og R2 bliver aldrig spurgt. Derfor er
cache-ratioen det eneste tal der virkelig betyder noget.

---

## Regnestykket

### Class A (skrivninger) — ikke noget at bekymre sig om

Én drikkevare med billede koster tre `PutObject` (THUMB, CARD, FULL).

```
1.000.000 Class A ÷ 3 pr. drikkevare ≈ 333.000 drikkevarer pr. måned
```

Et katalog der får 333.000 nye billeder om måneden har helt andre problemer.
Oprydningsjobbet sletter kun forældreløse nøgler og kører i batch.

### Class B (læsninger) — her ligger risikoen

Uden caching: hvert billede, hver visning, hver bruger.

```
Forside + katalogside ≈ 28 billeder
10.000.000 ÷ 28 ≈ 357.000 sidevisninger pr. måned
```

Lyder af meget, indtil man opdager at det er **uden** caching. Med en fornuftig
cache-ratio på 95 % bliver det:

```
357.000 ÷ 0,05 ≈ 7.100.000 sidevisninger pr. måned
```

Og fordi nøglerne er uforanderlige, er den realistiske cache-ratio højere end
95 %. Et billede læses fra R2 **én gang pr. Cloudflare-lokation**, og derefter
aldrig igen.

---

## Det du skal sætte op i Cloudflare

### 1. Brug et eget domæne, ikke `r2.dev`

`r2.dev`-underdomænet er rate limited, ikke beregnet til produktion, og det
**cacher ikke**. Hver visning bliver en Class B-operation.

Tilknyt i stedet et domæne under bucketens _Settings → Public access → Custom
Domains_, fx `media-maanslogen.mathiasfoldager.com`. Så går trafikken gennem
Cloudflares cache, og det er dét der gør resten muligt.

Sæt derefter:

```bash
R2_PUBLIC_BASE_URL=https://media-maanslogen.mathiasfoldager.com
NEXT_PUBLIC_MEDIA_URL=https://media-maanslogen.mathiasfoldager.com
```

### 2. En Cache Rule der holder på filerne

Under _Rules → Cache Rules_ på zonen:

| Felt              | Værdi                                                   |
| ----------------- | ------------------------------------------------------- |
| Hvis              | `Hostname equals media-maanslogen.mathiasfoldager.com`  |
| Cache eligibility | Eligible for cache                                      |
| Edge TTL          | Ignore cache-control header and use this TTL → **1 år** |
| Browser TTL       | Respect origin (vi sætter selv `immutable` på objektet) |

Edge TTL på et år er forsvarligt her, fordi en nøgle aldrig genbruges: hvert
upload får sit eget UUID i stien, og et billede bliver aldrig overskrevet.
Ændrer man billedet på en drikkevare, får det en ny nøgle — og den gamle bliver
ryddet op.

Uden reglen følger kanten objektets `Cache-Control`. Det virker også, men kun
hvis hvert eneste objekt fik headeren med ved upload. Reglen gør det
uafhængigt af klienten.

### 3. Tiered Cache

Under _Caching → Tiered Cache_ → slå **Smart Tiered Caching** til. Gratis.

Uden det henter hver Cloudflare-lokation sin egen kopi fra R2 — med ~300
lokationer betyder det op til 300 læsninger pr. fil. Med tiered caching henter
én øvre lokation filen, og resten henter fra den. Det er den næstvigtigste
indstilling efter selve cachen.

### 4. Livscyklusregel på bucketen

Under bucketens _Settings → Object lifecycle rules_: slet ufuldendte
multipart-uploads efter 1 dag. Det er et sikkerhedsnet under vores eget
oprydningsjob og koster ingenting.

---

## Det koden allerede gør

### Uforanderlige nøgler

```
beverage/2026/09/<asset-uuid>/card.webp
```

UUID'et dannes ved upload, og nøglen skrives præcis én gang. Der findes ingen
kodesti der overskriver et objekt. Det er forudsætningen for at kunne cache
uendeligt.

### `Cache-Control` sættes ved upload

`presignPut` beder klienten sende:

```
cache-control: public, max-age=31536000, immutable
```

`immutable` betyder at browseren ikke engang laver en betinget genforespørgsel
ved genindlæsning — den bruger sin kopi direkte.

Bemærk at presignede URL'er kun signerer `host`, så headeren er ikke håndhævet.
Den styrer browserens cache; kantens cache garanteres af Cache Rule'en.

### Billeder går uden om Next.js' optimering

`MediaImage` bruger `unoptimized`. Uden det ville Next hente originalen fra R2
til sin egen server for at gen-kode den — altså en R2-læsning _plus_ CPU-tid for
noget der allerede er gjort ved upload. Med `unoptimized` går browseren direkte
til `media-maanslogen.mathiasfoldager.com`, hvor cachen svarer.

Vi beholder lazy loading og den reserverede plads fra `next/image`, så billeder
under skærmkanten slet ikke bliver hentet.

### Varianter i stedet for én stor fil

Kataloget henter `CARD` (600 px), ikke `FULL` (1200 px). Admin-tabellen henter
`THUMB` (200 px). Det sparer ikke operationer, men det sparer båndbredde og
indlæsningstid — og det er grunden til at Next ikke behøver optimere.

### Ingen `HeadObject`

`statObject` er fjernet. Den var ubrugt og ville koste en Class B pr. kald.
Filstørrelsen rapporteres af klienten og valideres mod grænsen.

### Ingen `ListObjects`

Oprydningsjobbet slår op i `pending_uploads`-tabellen — vores egen database —
og sletter navngivne nøgler. Det lister aldrig bucketen.

(1.0 gjorde det modsatte: et cron-job listede _alle_ buckets hver uge.)

---

## Hvis du senere kommer tæt på grænsen

I den rækkefølge:

1. **Tjek cache-ratioen** under _Caching → Overview_ på zonen. Er den under
   90 %, er der noget galt med reglen — ikke med mængden af trafik.
2. **Færre varianter.** Drop `THUMB` og lad admin-tabellen bruge `CARD`. Sparer
   en tredjedel af skrivningerne.
3. **Cloudflare Images** hvis billedmængden bliver stor nok til at det giver
   mening at betale for transformation frem for at gemme flere varianter.
4. **Først derefter** er det værd at kigge på selve R2-forbruget.

For at overvåge det: _R2 → bucket → Metrics_ viser Class A og B pr. dag. Det er
værd at kigge på en gang om måneden i starten, indtil man kender sit mønster.
