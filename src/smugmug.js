/**
 * SmugMug-integrasjon som kjører server-side i Worker-en.
 *
 * Hvorfor server-side i det hele tatt:
 *   1. APIKey må ikke ligge i klientkoden — alt i /public er offentlig lesbart.
 *   2. api.smugmug.com sender ikke CORS-headere, så nettleseren får ikke lov
 *      til å lese svaret uansett.
 *
 * Worker-en henter derfor dataene, trimmer dem ned til det siden faktisk
 * trenger, og cacher resultatet på edgen.
 */

const DEFAULT_API_ROOT = "https://api.smugmug.com";
const UA = "dalhus-portfolio (+https://github.com/)";

/* -------------------------------------------------------------------------
   Hjelpere for å lese SmugMugs JSON defensivt.
   API-et returnerer litt ulike former avhengig av endepunkt og parametre,
   så vi antar så lite som mulig.
   ------------------------------------------------------------------------- */

/** Uris kan være { Uri: "/api/v2/..." } eller bare "/api/v2/..." (_shorturis). */
function uriValue(entry) {
  if (!entry) return null;
  if (typeof entry === "string") return entry;
  if (typeof entry === "object" && typeof entry.Uri === "string") return entry.Uri;
  return null;
}

/** Gjør en relativ SmugMug-URI om til en full URL med APIKey påsatt. */
function buildUrl(uri, apiKey, params = {}, apiRoot = DEFAULT_API_ROOT) {
  const url = new URL(uri.startsWith("http") ? uri : apiRoot + uri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
  }
  url.searchParams.set("APIKey", apiKey);
  return url.toString();
}

/**
 * Endepunktene legger nyttelasten under ulike nøkler (Album, AlbumImage,
 * Image, …). Vi plukker rett og slett den første arrayen i Response.
 */
function firstArray(response) {
  if (!response || typeof response !== "object") return [];
  for (const [key, value] of Object.entries(response)) {
    if (key === "Pages" || key === "Uris") continue;
    if (Array.isArray(value)) return value;
  }
  return [];
}

/**
 * Expansions er indeksert på URI, men selve nyttelasten ligger under en nøkkel
 * som varierer (Locator). Vi prøver de aktuelle nøklene i tur og orden.
 */
function expansionPayload(expansions, uri, keys) {
  const entry = expansions?.[uri];
  if (!entry || typeof entry !== "object") return null;
  const root = entry.Response && typeof entry.Response === "object" ? entry.Response : entry;
  for (const key of keys) {
    if (root[key] && typeof root[key] === "object") return root[key];
  }
  return null;
}

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cf: { cacheTtl: 300, cacheEverything: true },
  });
  if (!res.ok) {
    throw new Error(`SmugMug svarte ${res.status} på ${new URL(url).pathname}`);
  }
  return res.json();
}

/* -------------------------------------------------------------------------
   Bildestørrelser
   ------------------------------------------------------------------------- */

/**
 * Finn en fornuftig visnings-URL for et bilde.
 * Rekkefølge: en utvidet ImageSizeDetails i ønsket bredde → ThumbnailUrl.
 */
function pickImageUrls(image, expansions) {
  const thumb = typeof image.ThumbnailUrl === "string" ? image.ThumbnailUrl : null;

  const detailsUri = uriValue(image.Uris?.ImageSizeDetails) || uriValue(image.Uris?.ImageSizes);
  const details = detailsUri
    ? expansionPayload(expansions, detailsUri, ["ImageSizeDetails", "ImageSizes"])
    : null;

  const candidates = [];
  if (details && typeof details === "object") {
    for (const value of Object.values(details)) {
      if (value && typeof value === "object" && typeof value.Url === "string") {
        candidates.push({
          url: value.Url,
          width: Number(value.Width) || 0,
          height: Number(value.Height) || 0,
        });
      }
    }
  }
  candidates.sort((a, b) => a.width - b.width);

  // Minste variant som er minst 600px bred — ellers den største vi har.
  const display =
    candidates.find((c) => c.width >= 600) || candidates[candidates.length - 1] || null;
  const small = candidates.find((c) => c.width >= 200) || display;

  return {
    thumb: small?.url || thumb,
    display: display?.url || thumb,
    width: display?.width || null,
    height: display?.height || null,
  };
}

function normalizeImage(image, expansions) {
  const urls = pickImageUrls(image, expansions);
  if (!urls.thumb) return null;
  return {
    id: image.ImageKey || image.Uri || urls.thumb,
    title: image.Title || image.FileName || "",
    caption: image.Caption || "",
    webUri: image.WebUri || null,
    thumb: urls.thumb,
    display: urls.display,
    width: urls.width,
    height: urls.height,
    date: image.DateTimeOriginal || image.DateTimeUploaded || image.LastUpdated || null,
  };
}

function normalizeAlbum(album, expansions) {
  const highlightUri =
    uriValue(album.Uris?.AlbumHighlightImage) || uriValue(album.Uris?.HighlightImage);
  const highlight = highlightUri
    ? expansionPayload(expansions, highlightUri, ["AlbumImage", "Image", "HighlightImage"])
    : null;
  let cover = highlight?.ThumbnailUrl || null;

  if (highlight) {
    const picked = pickImageUrls(highlight, expansions);
    cover = picked.thumb || cover;
  }

  return {
    id: album.AlbumKey || album.NodeID || album.Uri,
    title: album.Name || album.Title || album.UrlName || "",
    description: album.Description || "",
    webUri: album.WebUri || null,
    imageCount: Number(album.ImageCount) || 0,
    date: album.LastUpdated || album.Date || album.ImagesLastUpdated || null,
    cover,
  };
}

function byDateDesc(a, b) {
  return String(b.date || "").localeCompare(String(a.date || ""));
}

/* -------------------------------------------------------------------------
   Henting
   ------------------------------------------------------------------------- */

/**
 * SmugMug er bygget rundt at man følger lenker (Uris) i stedet for å
 * hardkode stier. Vi henter derfor brukeren først og leser hvilke URI-er
 * kontoen faktisk tilbyr — det gjør oss robuste mot navneforskjeller.
 */
async function fetchUserUris(nickname, apiKey, apiRoot) {
  const data = await getJson(
    buildUrl(`/api/v2/user/${encodeURIComponent(nickname)}`, apiKey, {}, apiRoot),
  );
  const user = data?.Response?.User || {};
  return { user, uris: user.Uris || {} };
}

async function fetchRecentImages(uris, apiKey, count, warnings, apiRoot) {
  const candidates = ["UserRecentImages", "UserImageSearch", "UserFeaturedAlbums"];
  const key = candidates.find((name) => uriValue(uris[name]));
  if (!key) {
    warnings.push("Fant ingen URI for nye bilder på denne brukeren.");
    return [];
  }
  if (key !== "UserRecentImages") {
    warnings.push(`Brukte ${key} som fallback for nye bilder.`);
  }

  const url = buildUrl(
    uriValue(uris[key]),
    apiKey,
    { count, _expand: "ImageSizeDetails" },
    apiRoot,
  );
  const data = await getJson(url);
  const expansions = data?.Expansions || {};
  return firstArray(data?.Response)
    .map((image) => normalizeImage(image, expansions))
    .filter(Boolean)
    .slice(0, count);
}

async function fetchRecentAlbums(uris, apiKey, count, warnings, apiRoot) {
  const key = ["UserAlbums", "UserFeaturedAlbums"].find((name) => uriValue(uris[name]));
  if (!key) {
    warnings.push("Fant ingen URI for album på denne brukeren.");
    return [];
  }

  // Vi henter litt flere enn vi trenger og sorterer selv, siden hvilke
  // sorteringsparametre endepunktet godtar varierer.
  const url = buildUrl(
    uriValue(uris[key]),
    apiKey,
    { count: Math.max(count * 3, 20), _expand: "AlbumHighlightImage.ImageSizeDetails" },
    apiRoot,
  );
  const data = await getJson(url);
  const expansions = data?.Expansions || {};
  return firstArray(data?.Response)
    .map((album) => normalizeAlbum(album, expansions))
    .filter((album) => album.title)
    .sort(byDateDesc)
    .slice(0, count);
}

/* -------------------------------------------------------------------------
   Demo-data, brukes når APIKey ikke er satt ennå
   ------------------------------------------------------------------------- */

function demoPayload(imageCount, albumCount) {
  const images = Array.from({ length: imageCount }, (_, i) => ({
    id: `demo-image-${i}`,
    title: `Demobilde ${i + 1}`,
    caption: "",
    webUri: null,
    thumb: null,
    display: null,
    width: null,
    height: null,
    date: null,
    demo: true,
  }));
  const albums = Array.from({ length: albumCount }, (_, i) => ({
    id: `demo-album-${i}`,
    title: `Demoalbum ${i + 1}`,
    description: "",
    webUri: null,
    imageCount: 12 + i * 7,
    date: null,
    cover: null,
    demo: true,
  }));
  return { images, albums };
}

/* -------------------------------------------------------------------------
   Offentlig inngang
   ------------------------------------------------------------------------- */

export async function handleSmugmugRequest(request, env, ctx) {
  const url = new URL(request.url);
  const imageCount = clamp(url.searchParams.get("images"), 12, 1, 48);
  const albumCount = clamp(url.searchParams.get("albums"), 6, 1, 24);
  const debug = url.searchParams.get("debug") === "1";

  const cache = caches.default;
  const cacheKey = new Request(
    `${url.origin}/api/smugmug?images=${imageCount}&albums=${albumCount}&debug=${debug ? 1 : 0}`,
    { method: "GET" },
  );

  if (!debug) {
    const hit = await cache.match(cacheKey);
    if (hit) return hit;
  }

  const apiKey = env.SMUGMUG_API_KEY;
  const nickname = env.SMUGMUG_NICKNAME;
  // Kun for testing mot en mock — i produksjon er denne udefinert.
  const apiRoot = env.SMUGMUG_API_ROOT || DEFAULT_API_ROOT;
  const warnings = [];

  let payload;

  if (!apiKey || !nickname || nickname === "DITT-BRUKERNAVN") {
    payload = {
      source: "demo",
      reason: !apiKey
        ? "SMUGMUG_API_KEY er ikke satt (wrangler secret put SMUGMUG_API_KEY)."
        : "SMUGMUG_NICKNAME er ikke satt i wrangler.jsonc.",
      ...demoPayload(imageCount, albumCount),
      warnings,
    };
  } else {
    try {
      const { user, uris } = await fetchUserUris(nickname, apiKey, apiRoot);

      const [images, albums] = await Promise.all([
        fetchRecentImages(uris, apiKey, imageCount, warnings, apiRoot).catch((error) => {
          warnings.push(`Bilder: ${error.message}`);
          return [];
        }),
        fetchRecentAlbums(uris, apiKey, albumCount, warnings, apiRoot).catch((error) => {
          warnings.push(`Album: ${error.message}`);
          return [];
        }),
      ]);

      payload = {
        source: "live",
        nickname,
        profileUrl: user.WebUri || null,
        generatedAt: new Date().toISOString(),
        images,
        albums,
        warnings,
        ...(debug ? { availableUris: Object.keys(uris).sort() } : {}),
      };
    } catch (error) {
      payload = {
        source: "error",
        reason: error.message,
        images: [],
        albums: [],
        warnings,
      };
    }
  }

  const response = new Response(JSON.stringify(payload), {
    status: payload.source === "error" ? 502 : 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control":
        payload.source === "live"
          ? "public, max-age=300, s-maxage=900"
          : "no-store",
    },
  });

  if (payload.source === "live" && !debug) {
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
}

function clamp(raw, fallback, min, max) {
  const value = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}
