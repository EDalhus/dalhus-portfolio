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

/** Hvor mange bilder og album galleriet ber om. */
export const GALLERY = {
  images: 12,
  albums: 6,
  endpoint: "/api/smugmug",
};

/** Tetris-brettet og highscore-endepunktet. */
export const TETRIS = {
  cols: 10,
  rows: 20,
  cell: 22,
  endpoint: "/api/leaderboard",
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
    "menu.game": "Spill",
    "menu.skill": "Ferdighet",
    "menu.options": "Alternativer",
    "intro.tagline": "Bygger ting på nett. Prosjektene ligger i mappen under.",
    "projects.heading": "Prosjekter",
    "status.hint": "Klikk for å åpne",
    "dialog.title": "Avslutt Windows",
    "dialog.body": "Det er nå trygt å slå av maskinen.",
    "dialog.ok": "OK",

    "gallery.title": "Bilder — SmugMug",
    "gallery.tab.photos": "Siste bilder",
    "gallery.tab.albums": "Siste album",
    "gallery.loading": "Henter fra SmugMug …",
    "gallery.retry": "Prøv igjen",
    "gallery.empty": "Ingenting å vise ennå.",
    "gallery.demoTitle": "Demomodus",
    "gallery.errorTitle": "Kunne ikke hente data",
    "gallery.openOriginal": "Åpne på SmugMug",
    "gallery.close": "Lukk",
    "gallery.untitled": "Uten tittel",
    photos: (n) => `${n} bilde${n === 1 ? "" : "r"}`,
    albums: (n) => `${n} album`,
    imagesIn: (n) => `${n} bilde${n === 1 ? "" : "r"}`,
    objects: (n) => `${n} objekt${n === 1 ? "" : "er"}`,

    "tetris.title": "TETRIS for Windows",
    "tetris.tab.scores": "Poengliste",
    "tetris.tab.play": "Spill",
    "tetris.name.label": "Navn",
    "tetris.name.placeholder": "Skriv inn navnet ditt",
    "tetris.start": "Start",
    "tetris.pause": "Pause",
    "tetris.resume": "Fortsett",
    "tetris.playAgain": "Spill igjen",
    "tetris.paused": "Pause",
    "tetris.gameOver": "Game Over",
    "tetris.yourScore": "Din poengsum",
    "tetris.newHighScore": "Ny rekord!",
    "tetris.score": "Poeng",
    "tetris.level": "Nivå",
    "tetris.lines": "Linjer",
    "tetris.next": "Neste",
    "tetris.controls.hint": "Piltaster: flytt/roter · Mellomrom: hard drop · P: pause",
    "tetris.highScores.loading": "Henter poengliste …",
    "tetris.highScores.error": "Kunne ikke hente poengliste.",
    "tetris.highScores.empty": "Ingen har spilt ennå — bli den første!",
    "tetris.highScores.retry": "Prøv igjen",
    "tetris.highScores.rank": "#",
    "tetris.highScores.name": "Navn",
    "tetris.highScores.score": "Poeng",
    "tetris.highScores.level": "Nivå",
    "tetris.submitError": "Kunne ikke lagre poengsummen din, men den vises her lokalt.",
  },
  en: {
    docTitle: "Eirik Dalhus — Portfolio",
    "window.title": "Portfolio",
    "menu.file": "File",
    "menu.edit": "Edit",
    "menu.view": "View",
    "menu.help": "Help",
    "menu.game": "Game",
    "menu.skill": "Skill",
    "menu.options": "Options",
    "intro.tagline": "Building things on the web. The projects live in the folder below.",
    "projects.heading": "Projects",
    "status.hint": "Click to open",
    "dialog.title": "Shut Down Windows",
    "dialog.body": "It's now safe to turn off your computer.",
    "dialog.ok": "OK",

    "gallery.title": "Photos — SmugMug",
    "gallery.tab.photos": "Latest photos",
    "gallery.tab.albums": "Latest albums",
    "gallery.loading": "Fetching from SmugMug …",
    "gallery.retry": "Try again",
    "gallery.empty": "Nothing to show yet.",
    "gallery.demoTitle": "Demo mode",
    "gallery.errorTitle": "Could not fetch data",
    "gallery.openOriginal": "Open on SmugMug",
    "gallery.close": "Close",
    "gallery.untitled": "Untitled",
    photos: (n) => `${n} photo${n === 1 ? "" : "s"}`,
    albums: (n) => `${n} album${n === 1 ? "" : "s"}`,
    imagesIn: (n) => `${n} image${n === 1 ? "" : "s"}`,
    objects: (n) => `${n} object${n === 1 ? "" : "s"}`,

    "tetris.title": "TETRIS for Windows",
    "tetris.tab.scores": "High Scores",
    "tetris.tab.play": "Play",
    "tetris.name.label": "Name",
    "tetris.name.placeholder": "Enter your name",
    "tetris.start": "Start",
    "tetris.pause": "Pause",
    "tetris.resume": "Resume",
    "tetris.playAgain": "Play again",
    "tetris.paused": "Paused",
    "tetris.gameOver": "Game Over",
    "tetris.yourScore": "Your score",
    "tetris.newHighScore": "New high score!",
    "tetris.score": "Score",
    "tetris.level": "Level",
    "tetris.lines": "Lines",
    "tetris.next": "Next",
    "tetris.controls.hint": "Arrow keys: move/rotate · Space: hard drop · P: pause",
    "tetris.highScores.loading": "Fetching high scores …",
    "tetris.highScores.error": "Could not fetch high scores.",
    "tetris.highScores.empty": "Nobody's played yet — be the first!",
    "tetris.highScores.retry": "Try again",
    "tetris.highScores.rank": "#",
    "tetris.highScores.name": "Name",
    "tetris.highScores.score": "Score",
    "tetris.highScores.level": "Level",
    "tetris.submitError": "Couldn't save your score, but it's shown here locally.",
  },
};

export const LOCALES = { no: "nb-NO", en: "en-GB" };
