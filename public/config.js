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
 * Eget vindu for ett bestemt SmugMug-album (The Gathering 2026), i stedet
 * for kontoens siste bilder. Stien er den samme som i den pene URL-en
 * (https://eirikdalhus.smugmug.com/FA/KANDU/TG26H → "/FA/KANDU/TG26H").
 */
export const GATHERING_ALBUM_PATH = "/FA/KANDU/TG26H";

/** Tetris-brettet og highscore-endepunktet. */
export const TETRIS = {
  cols: 10,
  rows: 20,
  cell: 22,
  endpoint: "/api/leaderboard",
};

/** Minesveiper-vanskelighetsgrader. */
export const MINESWEEPER = {
  presets: {
    beginner: { cols: 9, rows: 9, mines: 10 },
    intermediate: { cols: 16, rows: 16, mines: 40 },
    expert: { cols: 30, rows: 16, mines: 99 },
  },
  defaultPreset: "beginner",
  cell: 24,
};

/** Flipperbordets mål (i canvas-piksler). */
export const PINBALL = {
  width: 400,
  height: 640,
  ballRadius: 8,
  startBalls: 3,
};

/** Kortstørrelse for Kabal (piksler). */
export const SOLITAIRE = {
  cardWidth: 54,
  cardHeight: 76,
  faceUpOffset: 20,
  faceDownOffset: 8,
};

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
    "Highscore-lista i Tetris er offentlig for alle. Ingen press.",
    "Du kan endre størrelse på et vindu ved å dra i et hjørne.",
    "Jeg har ikke vært klarert siden 2007, men jeg prøver mitt beste.",
    "Minesveiper-flagg settes med høyreklikk. Eller «Flagg-modus» på mobil.",
    "Hvis du lukker Portefølje-vinduet, kommer det opp en overraskelse.",
    "Jeg dukker ikke opp igjen med mindre du klikker meg frem i systemkurven.",
  ],
  en: [
    "It looks like you're trying to view a portfolio. Would you like help with that?",
    "Did you know you can drag windows around by their title bar?",
    "Psst — try the Vista theme in the system tray, down there on the right.",
    "My name's Binders. Or Clippy. Nobody's really sure anymore.",
    "The Tetris high score list is public for everyone. No pressure.",
    "You can resize a window by dragging one of its corners.",
    "I haven't been trusted since 2007, but I'm doing my best.",
    "Right-click flags a Minesweeper cell. Or use \"Flag mode\" on mobile.",
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

    "minesweeper.title": "Minesveiper",
    "minesweeper.difficulty.beginner": "Nybegynner",
    "minesweeper.difficulty.intermediate": "Middels",
    "minesweeper.difficulty.expert": "Ekspert",
    "minesweeper.newGame": "Nytt spill",
    "minesweeper.hint": "Klikk for å avdekke · Høyreklikk for å flagge",
    "minesweeper.flagMode": "Flagg-modus",

    "pinball.title": "3D Flipperspill",
    "pinball.score": "Poeng",
    "pinball.balls": "Baller",
    "pinball.start": "Start",
    "pinball.playAgain": "Spill igjen",
    "pinball.paused": "Pause",
    "pinball.resume": "Fortsett",
    "pinball.gameOver": "Game Over",
    "pinball.yourScore": "Din poengsum",
    "pinball.controls.hint": "◀ ▶: flippere · Mellomrom: skyt ut ballen · P: pause",
    "pinball.launch": "Hold Mellomrom for å skyte ut",

    "solitaire.title": "Kabal",
    "solitaire.newGame": "Nytt spill",
    "solitaire.hint": "Klikk for å velge · dobbeltklikk for å sende til fundament",
    "solitaire.won": "Du vant! 🎉",
    "solitaire.moves": "Trekk",
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

    "minesweeper.title": "Minesweeper",
    "minesweeper.difficulty.beginner": "Beginner",
    "minesweeper.difficulty.intermediate": "Intermediate",
    "minesweeper.difficulty.expert": "Expert",
    "minesweeper.newGame": "New game",
    "minesweeper.hint": "Click to reveal · Right-click to flag",
    "minesweeper.flagMode": "Flag mode",

    "pinball.title": "3D Pinball",
    "pinball.score": "Score",
    "pinball.balls": "Balls",
    "pinball.start": "Start",
    "pinball.playAgain": "Play again",
    "pinball.paused": "Paused",
    "pinball.resume": "Resume",
    "pinball.gameOver": "Game Over",
    "pinball.yourScore": "Your score",
    "pinball.controls.hint": "◀ ▶: flippers · Space: launch ball · P: pause",
    "pinball.launch": "Hold Space to launch",

    "solitaire.title": "Solitaire",
    "solitaire.newGame": "New game",
    "solitaire.hint": "Click to select · double-click to send to a foundation",
    "solitaire.won": "You won! 🎉",
    "solitaire.moves": "Moves",
  },
};

export const LOCALES = { no: "nb-NO", en: "en-GB" };
