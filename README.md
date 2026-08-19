# dalhus-portfolio

Statisk porteføljeside i Windows 95-stil, servert fra Cloudflare Workers med
[Static Assets](https://developers.cloudflare.com/workers/static-assets/), med
et SmugMug-galleri, et Tetris-spill med offentlig highscore-liste (server-side
i Worker-en), og Minesveiper + et enkelt flipperspill som begge kjører helt
lokalt i nettleseren.

Ingen byggesteg, ingen rammeverk, ingen avhengigheter i nettleseren.

## Struktur

```
.
├── wrangler.jsonc        # Worker-config: assets, vars, KV, 404-håndtering
├── .dev.vars.example     # Mal for lokale hemmeligheter
├── src/
│   ├── index.js          # Ruting: /healthz, /api/smugmug, /api/leaderboard, ellers assets
│   ├── smugmug.js        # SmugMug-henting, normalisering og caching
│   └── leaderboard.js    # Tetris-highscore i Workers KV
└── public/               # Serveres statisk fra Cloudflares edge
    ├── index.html
    ├── styles.css        # Hele Win95-temaet
    ├── config.js         # Prosjekter, tekster, galleri-/Tetris-innstillinger
    ├── app.js            # Skall: språk, klokke, klikkelyder
    ├── windows.js        # Vindusbehandler: åpne/dra/endre størrelse, Start-meny
    ├── gallery.js        # createGallery() — driver både SmugMug- og The Gathering-vinduet
    ├── tetris.js         # Spillmotor + highscore-liste
    ├── minesweeper.js    # Klassisk Minesveiper, helt lokalt
    ├── pinball.js        # Enkelt flipperspill med 2D-fysikk
    ├── _headers          # Sikkerhetsheadere for de statiske filene
    ├── 404.html
    └── favicon.svg
```

## Kom i gang

```bash
npm install
cp .dev.vars.example .dev.vars   # fyll inn nøkkel og brukernavn
npm run dev                      # http://localhost:8787
npm run deploy
```

Første gang: `npx wrangler login`.

## SmugMug-integrasjonen

### Hvorfor den kjører i Worker-en

To grunner til at siden ikke kan snakke direkte med SmugMug fra nettleseren:

1. **API-nøkkelen.** SmugMug krever `APIKey=…` på hver forespørsel. Alt i
   `public/` er offentlig lesbart, så nøkkelen kan ikke ligge der.
2. **CORS.** `api.smugmug.com` sender ingen `Access-Control-Allow-Origin`, så
   nettleseren nekter å lese svaret uansett.

Worker-en henter derfor dataene, trimmer dem til det siden trenger, og cacher
resultatet på edgen. Siden er fortsatt helstatisk.

### Oppsett

1. Søk om nøkkel på <https://api.smugmug.com/api/developer/apply>.
2. Sett brukernavnet ditt i `wrangler.jsonc` under `vars.SMUGMUG_NICKNAME`
   (delen som står i URL-en til siden din, f.eks. `cmac` for
   `cmac.smugmug.com`).
3. Legg inn nøkkelen som secret — den skal aldri i git:

   ```bash
   npx wrangler secret put SMUGMUG_API_KEY
   ```

Uten nøkkel svarer endepunktet med `source: "demo"` og siden viser
plassholdere, slik at alt fungerer før nøkkelen er på plass.

### Endepunktet

```
GET /api/smugmug?images=100&offset=0
GET /api/smugmug?debug=1        # tar med hvilke URI-er kontoen tilbyr
```

Svaret er trimmet ned til:

```jsonc
{
  "source": "live",            // "live" | "demo" | "error"
  "images": [{ "id", "title", "webUri", "thumb", "display", "date" }],
  "hasMore": true,             // finnes det flere bilder å hente etter disse?
  "warnings": []
}
```

`images` er hvor mange denne forespørselen skal gi (maks 200), `offset`
er hvor i den fulle listen den skal starte (0-indeksert). Siden laster
100 bilder først, og henter automatisk 50 til (`offset` = antall den
allerede har) når du scroller til bunnen av galleriet — se
`GALLERY.images`/`GALLERY.pageSize` i `public/config.js` og
`loadMore()` i `public/gallery.js`. Hver side hentes i biter av 50 fra
SmugMug internt og settes sammen til listen `images` returnerer.
Klikk på et bilde åpner en lokal forhåndsvisning (med forrige/neste) i
stedet for å hoppe til SmugMug.

### Hvordan den finner dataene

SmugMug er bygget rundt at man følger `Uris`-lenker i stedet for å hardkode
stier, og hvilke URI-er en konto tilbyr varierer. Worker-en henter derfor
`/api/v2/user/<nickname>` først, leser `Uris`-blokken, og bruker
`UserRecentImages` derfra — med fallback hvis den mangler.

Ser galleriet tomt ut, kall `/api/smugmug?debug=1`: den lister URI-ene kontoen
din faktisk har, og `warnings` sier hva som feilet.

### Caching

Svaret caches i Cloudflares edge-cache i 15 minutter (`s-maxage=900`), og
nettleseren cacher i 5. Nye bilder dukker altså opp innen et kvarter. Vil du
ha det raskere, senk verdiene i `handleSmugmugRequest`.

### Private album

Anonym tilgang med API-nøkkel når bare **offentlige** bilder. Private eller
skjulte album krever full OAuth 1.0a-signering med en access token — en god del
mer arbeid, og det krever et sted å lagre token (f.eks. Workers KV).

### Ett bestemt album (`?album=`)

```
GET /api/smugmug?images=100&offset=0&album=/FA/KANDU/TG26H
```

`album` er stien fra den pene SmugMug-URL-en, uten domenet (så
`https://eirikdalhus.smugmug.com/FA/KANDU/TG26H` blir `/FA/KANDU/TG26H`).
Worker-en slår den opp via kontoens `UrlPathLookup`-URI for å finne
albumets `AlbumImages`-lenke, og henter/paginerer derfra på samme måte som
`UserRecentImages`. Svaret får i tillegg et `album: { title, webUri }`-felt.

**Testet kun i demo-modus herfra** — jeg har ikke en ekte `SMUGMUG_API_KEY`
tilgjengelig i dette miljøet, så `UrlPathLookup`-oppslaget (`findAlbumImagesUri`
i `src/smugmug.js`) er skrevet defensivt ut fra hvordan resten av SmugMug-APIet
oppfører seg, men ikke verifisert mot et ekte svar. Fungerer ikke
«The Gathering 2026»-vinduet når det er deployet: kall
`/api/smugmug?album=/FA/KANDU/TG26H&debug=1` og se på `warnings`.

## Skrivebordet

Over 520px bredde oppfører vinduene seg som ekte Windows 95-vinduer:

- Skrivebordsikonene («Portfolio», «SmugMug», «The Gathering 2026», «Tetris»,
  «Minesveiper», «3D Flipperspill») åpner vinduene — de er lukket til man
  klikker, bortsett fra SmugMug-galleriet som åpnes automatisk med det samme
  siden lastes.
- Tittellinjen kan dras for å flytte vinduet.
- Hjørnene kan dras for å endre størrelse (minimum ca. 280×220px).
- Start-knappen åpner en Start-meny som henger fast over oppgavelinjen og
  ikke flytter seg ved rulling.
- Klikk spiller av en kort, syntetisert klikkelyd (Web Audio, ingen lydfil).

Under 520px faller alt tilbake til vanlig, stablet dokumentflyt uten dra/
endre størrelse — logikken for dette ligger i `public/windows.js`.

## Tetris

Et lite Tetris-spill i vinduet, med en offentlig highscore-liste som lagres
i Workers KV.

- Åpner du vinduet vises **Poengliste**-fanen først — topplisten er synlig
  for alle besøkende med det samme, uten å måtte spille.
- **Spill**-fanen ber om et navn (lagres i `localStorage`, forhåndsutfylt
  neste gang) før man kan starte.
- Styring: piltaster for å flytte/rotere, mellomrom for hard drop, `P` for
  pause. På skjermer under 520px vises knapper for berøring i stedet.
- Når spillet er over sendes poengsummen automatisk til
  `/api/leaderboard`, og lista friskes opp.

### Sett opp highscore-lagring (Workers KV)

Highscore-endepunktet trenger en KV-namespace. Uten en ekte en kjører
`npm run dev` fint (wrangler simulerer den lokalt), men `wrangler deploy`
feiler.

```bash
npx wrangler kv namespace create LEADERBOARD
```

Lim inn `id`-en du får tilbake i `wrangler.jsonc` under `kv_namespaces`.

### Viktig: dette er et åpent, ikke-autentisert endepunkt

`/api/leaderboard` validerer at poengsummen er et rimelig tall og saniterer
navnet, men det finnes ingen server-side verifisering av at scoren faktisk
ble spilt — hvem som helst kan POSTe en falsk highscore direkte mot
endepunktet. Helt greit for en portefølje-lekeplass, men ikke bygg videre på
dette uten å tenke gjennom det hvis det noen gang blir mer enn det.

## Minesveiper

Klassisk Minesveiper (`public/minesweeper.js`), helt lokalt — ingen
server-data, ingen highscore. Nybegynner/Middels/Ekspert bytter brettstørrelse,
venstreklikk avdekker (og "chorder" et avdekket tall hvis nok flagg står
rundt det), høyreklikk flagger. "Flagg-modus"-knappen bytter venstreklikk
til å flagge i stedet, for mobil uten høyreklikk.

## Flipperspill

Et enkelt flipperspill (`public/pinball.js`) med ekte 2D-fysikk — tyngdekraft,
veggkollisjon, bumpere som gir et "kick", og flippere som gir ballen fart
basert på hvor fort de svinger når de treffer den (ikke bare et fast reflekt).
Dette er en **v1 med et originaltegnet baneoppsett** — ingen grafikk fra det
klassiske "3D Pinball for Windows – Space Cadet" er brukt. Styring: piltaster
for flipperne, mellomrom for å lade og skyte ut ballen, `P` for pause.

Banens vegger er definert som en liste linjesegmenter i `WALLS`
(`public/pinball.js`) — brettet er tegnet for hånd som koordinater, ikke
importert fra noe sted. Vil du justere formen, er det her du gjør det; pass på
at hvert segment faktisk møter det neste (et gap, selv på under en pikselbredde
mellom to vegger, lar ballen falle rett gjennom).

## Legge til et prosjekt

Alt innhold ligger i `public/config.js`:

```js
{
  name: "Navnet på prosjektet",
  url: "https://…",
  desc: { no: "Norsk beskrivelse.", en: "English description." },
  tags: ["TypeScript", "Cloudflare"],   // kan være []
  type: "folder",                        // "folder" | "link"
}
```

Listen rendres automatisk, og telleren i statuslinjen oppdaterer seg selv.

## Endre tekster

Oversettelsene ligger i `STRINGS` i `public/config.js`, med én nøkkel per
språk. I HTML kobles de på med `data-i18n="nøkkel"`. Språkvalget huskes i
`localStorage`; første besøk gjetter ut fra nettleserspråket.

## Deploy automatisk fra GitHub

Cloudflare kan koble seg rett på GitHub-repoet og deploye ved hver push, uten
GitHub Actions. Det heter **Workers Builds**.

1. Dashbordet: **Workers & Pages → dalhus-portfolio → Settings → Builds →
   Connect**, og følg stegene for GitHub.
2. Innstillinger:

   | Felt | Verdi |
   | --- | --- |
   | Git branch | `main` |
   | Root directory | *(tomt — repoet har prosjektet i rota)* |
   | Build command | *(tomt — ingen byggesteg)* |
   | Deploy command | `npx wrangler deploy` |

3. Push til `main`, så bygger og deployer Cloudflare selv.

**Viktig:** Worker-navnet i dashbordet må være identisk med `name` i
`wrangler.jsonc` (`dalhus-portfolio`), ellers feiler bygget.

**Like viktig:** «Build variables and secrets» i byggeoppsettet gjelder bare
*under* bygget. `SMUGMUG_API_KEY` må siden bruker på kjøretid, og settes derfor
med `npx wrangler secret put SMUGMUG_API_KEY` (eller under **Settings →
Variables and Secrets** i dashbordet) — ikke som en build-variabel.

## Egendefinert domene

Cloudflare-dashbordet: **Workers & Pages → dalhus-portfolio → Settings →
Domains & Routes → Add custom domain**. Domenet må ligge på samme konto.

## Notater

- Statiske filer serveres uten at Worker-en kjører, så sikkerhetsheaderne (CSP
  m.m.) ligger i `public/_headers`. CSP-en tillater bilder fra
  `*.smugmug.com` — legger du til andre eksterne ressurser må den utvides.
- `/healthz` svarer `ok` i ren tekst, grei å peke en uptime-sjekk mot.
