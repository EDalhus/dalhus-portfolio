# dalhus-portfolio

Statisk porteføljeside i Windows 95-stil, servert fra Cloudflare Workers med
[Static Assets](https://developers.cloudflare.com/workers/static-assets/). Et
SmugMug-galleri med kontoens siste bilder, og ett skrivebordsikon per galleri
i valgte SmugMug-mapper.

Ingen byggesteg, ingen rammeverk, ingen avhengigheter i nettleseren.

## Struktur

```
.
├── wrangler.jsonc        # Worker-config: assets, vars, 404-håndtering
├── .dev.vars.example     # Mal for lokale hemmeligheter
├── src/
│   ├── index.js          # Ruting: /healthz, /api/smugmug, ellers assets
│   └── smugmug.js        # SmugMug-henting, normalisering og caching
└── public/               # Serveres statisk fra Cloudflares edge
    ├── index.html
    ├── styles.css        # Hele Win95-temaet (standard)
    ├── vista.css         # Windows Vista/Aero-tema — lastes disabled, se «Tema»
    ├── config.js         # Prosjekter, tekster, galleri-innstillinger, SmugMug-mapper
    ├── app.js            # Skall: språk, tema, klokke, klikkelyder
    ├── windows.js        # Vindusbehandler: åpne/dra/endre størrelse, Start-meny
    ├── gallery.js        # createGallery() — driver hvert galleri-vindu
    ├── folder-galleries.js # Ett ikon + vindu per galleri i SmugMug-mappene
    ├── clippy.js         # Clippy-widgeten
    ├── _headers          # Sikkerhetsheadere for de statiske filene
    ├── 404.html
    ├── clippy.png
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
GET /api/smugmug?album=/FA/KANDU/TG26H   # ett bestemt album
GET /api/smugmug?folder=/FA/KANDU        # listen med gallerier i en mappe
GET /api/smugmug?debug=1                 # tar med hvilke URI-er kontoen tilbyr
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

### Galleriene i en mappe (`?folder=`)

```
GET /api/smugmug?folder=/FA/KANDU
```

Slår opp mappe-stien via `UrlPathLookup`, følger `FolderAlbums`-lenken, og
returnerer ett innslag per galleri i mappen:

```jsonc
{
  "source": "live",
  "folder": { "name": "KANDU", "webUri": "https://…/FA/KANDU" },
  "albums": [
    { "name", "path", "webUri", "thumb", "imageCount", "date" }
  ],
  "warnings": []
}
```

`public/folder-galleries.js` kaller dette for hver mappe i `SMUGMUG_FOLDERS`
(`public/config.js`, i dag `/FA/SDOK` og `/FA/KANDU`) ved lasting, og bygger
ett skrivebordsikon + galleri-vindu per galleri. Legger du til et galleri i
en av mappene, dukker ikonet opp av seg selv neste gang siden lastes —
ingenting å redigere. `!albums` er rekursiv, så gallerier i eventuelle
undermapper havner også i lista.

## Skrivebordet

Over 520px bredde oppfører vinduene seg som ekte Windows 95-vinduer:

- Skrivebordsikonene åpner vinduene. Faste ikoner: «Portefølje» og «SmugMug»
  (kontoens siste bilder). I tillegg ett ikon per galleri i mappene i
  `SMUGMUG_FOLDERS` (se `?folder=` over).
- Ingenting åpnes automatisk — siden viser bare skrivebordet med ikonene, og
  man velger selv hva som skal åpnes.
- Tittellinjen kan dras for å flytte vinduet.
- Hjørnene kan dras for å endre størrelse (minimum ca. 280×220px).
- Start-knappen åpner en Start-meny som henger fast over oppgavelinjen og
  ikke flytter seg ved rulling.
- Klikk spiller av en kort, syntetisert klikkelyd (Web Audio, ingen lydfil).

Under 520px faller alt tilbake til vanlig, stablet dokumentflyt uten dra/
endre størrelse — logikken for dette ligger i `public/windows.js`.

## Tema

🎨-knappen i systemkurven (ved klokka) bytter mellom to temaer:

- **Windows 95** — standard, harde piksel-bevels, MS Sans Serif.
- **Windows Vista/Aero** — glassaktige, gjennomsiktige vinduer med
  `backdrop-filter: blur()`, avrundede hjørner, en rund grønn Start-orb,
  og en mørk gjennomsiktig oppgavelinje. Ingen ekte Vista-bilder eller
  -fonter er brukt — alt er håndtegnet CSS (gradienter, `conic-gradient`
  for "Aurora"-bakgrunnen), i tråd med resten av siden.

Valget lagres i `localStorage` (samme mønster som språkvalget) og huskes
neste besøk.

**Arkitektur:** `public/vista.css` lastes alltid inn i `<head>`, men med
`disabled` fra start. `applyTheme()` i `public/app.js` slår den av/på via
`link.disabled` — siden den ligger etter `styles.css` i dokumentet, trumfer
reglene der de vanlige Win95-reglene med samme selektor når den er aktiv,
uten at noe trenger et `[data-theme]`-prefiks. Temaet er avgrenset til selve
"OS-skallet" (vinduer, knapper, taskbar, Start-meny, skrivebord); galleri-
innholdet arver herfra der det gir mening.

Vil du legge til et tredje tema, følg samme oppskrift: en ny
`public/<navn>.css`, en ny `<link ... disabled>` i `index.html`, og en
gren til i `applyTheme()`.

## Clippy

Kontorassistenten fra gamle dager (`public/clippy.js`), gjenopplivet som en
frittstående 📎-widget som flyter over resten av skrivebordet — den er ikke
et vindu i vindussystemet. Klikk ham for å bla til neste tips, dra ham dit du
vil ha ham, eller lukk ham med krysset på boblen. Om du jager ham vekk dukker
det opp en liten 📎-knapp i systemkurven for å hente ham tilbake; valget
huskes i `localStorage`. Tipsene ligger i `CLIPPY_TIPS` i `public/config.js`.

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
