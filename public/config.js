/* ==========================================================================
   config.js — alt innhold du normalt vil redigere ligger her.
   ========================================================================== */

/**
 * Prosjektene som vises i hovedvinduet.
 *   name  — vises som filnavn
 *   url   — hvor lenken går
 *   desc  — kort beskrivelse på begge språk
 *   tags  — valgfri liste med stikkord (kan være [])
 *   type  — "folder" (standard) eller "link" for eksterne snarveier
 */
export const PROJECTS = [
  {
    name: "Prosjekt én",
    url: "https://example.com/prosjekt-en",
    desc: {
      no: "Bytt ut denne teksten med en setning om hva prosjektet er.",
      en: "Replace this text with one sentence about what the project is.",
    },
    tags: ["TypeScript", "Cloudflare"],
    type: "folder",
  },
  {
    name: "Prosjekt to",
    url: "https://example.com/prosjekt-to",
    desc: {
      no: "Kort beskrivelse på norsk.",
      en: "Short description in English.",
    },
    tags: ["Python"],
    type: "folder",
  },
  {
    name: "GitHub",
    url: "https://github.com/",
    desc: {
      no: "Alt annet jeg roter med.",
      en: "Everything else I tinker with.",
    },
    tags: [],
    type: "link",
  },
];

/** Galleriets bildeinnlasting: en første pulje, deretter flere ved scroll. */
export const GALLERY = {
  images: 100,
  pageSize: 50,
  endpoint: "/api/smugmug",
};

/**
 * SmugMug-mappene skrivebordet lager ett ikon per galleri av. Stiene er de
 * samme som i de pene URL-ene (https://eirikdalhus.smugmug.com/FA/SDOK →
 * "/FA/SDOK"). Worker-en lister galleriene i hver mappe via
 * /api/smugmug?folder=<sti>, og folder-galleries.js bygger ett ikon + vindu
 * per galleri — legger du til et galleri i SmugMug, dukker ikonet opp av seg
 * selv. `!albums` er rekursiv, så gallerier i undermapper blir også med.
 */
export const SMUGMUG_FOLDERS = ["/FA/SDOK", "/FA/KANDU"];

/**
 * Clippys tips — rullerer når man klikker ham. Rent for gøy, ingen logikk
 * bak innholdet.
 */
export const CLIPPY_TIPS = {
  no: [
    "Det ser ut som du prøver å se på en portefølje. Vil du ha hjelp med det?",
    "Visste du at du kan dra vinduene rundt etter tittellinjen?",
    "Psst — prøv Vista-temaet i systemkurven, oppe til høyre der nede.",
    "Jeg heter Binders. Eller Clippy. Ingen er helt sikre lenger.",
    "Hvert galleri på skrivebordet er sin egen mappe fra SmugMug.",
    "Du kan endre størrelse på et vindu ved å dra i et hjørne.",
    "Jeg har ikke vært klarert siden 2007, men jeg prøver mitt beste.",
    "Klikk et bilde i et galleri for å bla gjennom det i stor størrelse.",
    "Hvis du lukker Portefølje-vinduet, kommer det opp en overraskelse.",
    "Jeg dukker ikke opp igjen med mindre du klikker meg frem i systemkurven.",
  ],
  en: [
    "It looks like you're trying to view a portfolio. Would you like help with that?",
    "Did you know you can drag windows around by their title bar?",
    "Psst — try the Vista theme in the system tray, down there on the right.",
    "My name's Binders. Or Clippy. Nobody's really sure anymore.",
    "Every gallery on the desktop is its own folder from SmugMug.",
    "You can resize a window by dragging one of its corners.",
    "I haven't been trusted since 2007, but I'm doing my best.",
    "Click a photo in a gallery to page through it at full size.",
    "Closing the Portfolio window has a little surprise waiting.",
    "I won't come back unless you click me back on from the system tray.",
  ],
};

/** Tekster i to språk. Nøklene matcher data-i18n i index.html. */
export const STRINGS = {
  no: {
    docTitle: "Eirik Dalhus — Portefølje",
    "window.title": "Portefølje",
    "menu.file": "Fil",
    "menu.edit": "Rediger",
    "menu.view": "Vis",
    "menu.help": "Hjelp",
    "intro.tagline": "Bygger ting på nett. Prosjektene ligger i mappen under.",
    "projects.heading": "Prosjekter",
    "status.hint": "Klikk for å åpne",
    "dialog.title": "Avslutt Windows",
    "dialog.body": "Det er nå trygt å slå av maskinen.",
    "dialog.ok": "OK",

    "gallery.title": "Bilder — SmugMug",
    "gallery.loading": "Henter fra SmugMug …",
    "gallery.loadingMore": "Henter flere bilder …",
    "gallery.retry": "Prøv igjen",
    "gallery.empty": "Ingenting å vise ennå.",
    "gallery.demoTitle": "Demomodus",
    "gallery.errorTitle": "Kunne ikke hente data",
    "gallery.openOriginal": "Åpne på SmugMug",
    "gallery.close": "Lukk",
    "gallery.prev": "Forrige",
    "gallery.next": "Neste",
    "gallery.untitled": "Uten tittel",
    photos: (n) => `${n} bilde${n === 1 ? "" : "r"}`,
    objects: (n) => `${n} objekt${n === 1 ? "" : "er"}`,
  },
  en: {
    docTitle: "Eirik Dalhus — Portfolio",
    "window.title": "Portfolio",
    "menu.file": "File",
    "menu.edit": "Edit",
    "menu.view": "View",
    "menu.help": "Help",
    "intro.tagline": "Building things on the web. The projects live in the folder below.",
    "projects.heading": "Projects",
    "status.hint": "Click to open",
    "dialog.title": "Shut Down Windows",
    "dialog.body": "It's now safe to turn off your computer.",
    "dialog.ok": "OK",

    "gallery.title": "Photos — SmugMug",
    "gallery.loading": "Fetching from SmugMug …",
    "gallery.loadingMore": "Fetching more photos …",
    "gallery.retry": "Try again",
    "gallery.empty": "Nothing to show yet.",
    "gallery.demoTitle": "Demo mode",
    "gallery.errorTitle": "Could not fetch data",
    "gallery.openOriginal": "Open on SmugMug",
    "gallery.close": "Close",
    "gallery.prev": "Previous",
    "gallery.next": "Next",
    "gallery.untitled": "Untitled",
    photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
    objects: (n) => `${n} object${n === 1 ? "" : "s"}`,
  },
};

export const LOCALES = { no: "nb-NO", en: "en-GB" };
