# Skrifter

De tre skrifter ligger her som filer i stedet for at blive hentet fra Google,
når der bygges.

## Hvorfor

`next/font/google` henter skriftfilerne over nettet på byggetidspunktet. Det
gjorde byggeriet afhængigt af, at `fonts.googleapis.com` og
`fonts.gstatic.com` kan nås fra den maskine der bygger — og i CI holdt det
ikke. Samme workflow byggede grønt otte gange og faldt to, altid med samme
fejl fra Turbopack:

```
Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
next/font/google queries have exactly one entry
```

De to fejlende kørsler lå på commits der ikke rørte webkode, og den ene lå på
`main`. Det er altså ikke en fejl i koden, men en byggetidsafhængighed til en
tjeneste udenfor. Den ville ramme en udrulning lige så godt som et PR, og den
kan ikke køres om til grøn med mening.

Oveni: besøgende henter nu ingenting fra et tredjepartsdomæne.

## Hvad der ligger her

| Fil                          | Skrift         | Akse    | Licens  |
| ---------------------------- | -------------- | ------- | ------- |
| `space-grotesk-latin.woff2`  | Space Grotesk  | 300–700 | OFL 1.1 |
| `jetbrains-mono-latin.woff2` | JetBrains Mono | 100–800 | OFL 1.1 |
| `public-sans-latin.woff2`    | Public Sans    | 100–900 | OFL 1.1 |

Ét variabelt snit pr. skrift, latin-udsnittet (U+0000–00FF m.fl., så æ, ø og å
er med). Tilsammen 87 kB — mindre end de ni faste vægte, der blev hentet før.

Licensteksten for hver skrift ligger ved siden af som `<skrift>-OFL.txt`, med
den ophavsretslinje der hører til. OFL 1.1 tillader at filerne ligger her,
så længe licensen følger med.

## Sådan opdateres de

Hent CSS'en med en browser-UA — ellers svarer Google med `ttf` i stedet for
`woff2` — og tag URL'en fra `/* latin */`-blokken:

```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36'
curl -A "$UA" 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap'
```

Ændrer aksens spænd sig, skal `weight` i `src/app/layout.tsx` rettes med.
