# dalhus-portfolio

Statisk porteføljeside i Windows 95-stil, servert fra Cloudflare Workers med
[Static Assets](https://developers.cloudflare.com/workers/static-assets/), med
et SmugMug-galleri som hentes server-side i Worker-en.

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
    ├── styles.css        # Hele Win95-temaet
    ├── config.js         # Prosjekter, tekster, gallerinnstillinger
    ├── app.js            # Skall: språk, vinduer, oppgavelinje
    ├── gallery.js        # Tegner SmugMug-galleriet
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
GET /api/smugmug?images=12&albums=6
GET /api/smugmug?debug=1        # tar med hvilke URI-er kontoen tilbyr
```

Svaret er trimmet ned til:

```jsonc
{
  "source": "live",            // "live" | "demo" | "error"
  "images": [{ "id", "title", "webUri", "thumb", "display", "date" }],
  "albums": [{ "id", "title", "webUri", "imageCount", "date", "cover" }],
  "warnings": []
}
```

### Hvordan den finner dataene

SmugMug er bygget rundt at man følger `Uris`-lenker i stedet for å hardkode
stier, og hvilke URI-er en konto tilbyr varierer. Worker-en henter derfor
`/api/v2/user/<nickname>` først, leser `Uris`-blokken, og bruker
`UserRecentImages` og `UserAlbums` derfra — med fallback hvis de mangler.

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
