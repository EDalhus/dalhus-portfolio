/* ==========================================================================
   app.js — skallet: språk, klokke, klikkelyder.
   Innhold ligger i config.js, galleriet i gallery.js, vinduene i windows.js.
   ========================================================================== */

import { PROJECTS, STRINGS, LOCALES, GATHERING_ALBUM_PATH } from "./config.js";
import { createGallery } from "./gallery.js";
import * as tetris from "./tetris.js";
import * as minesweeper from "./minesweeper.js";
import * as pinball from "./pinball.js";
import * as solitaire from "./solitaire.js";
import * as clippy from "./clippy.js";
import * as windows from "./windows.js";

const STORAGE_KEY = "dalhus.lang";
const THEME_STORAGE_KEY = "dalhus.theme";
const SOUND_SELECTOR = "button, .desktop-icon, .file-item, .start-menu-item";

const gallery = createGallery({ bodyId: "gallery-body", statusId: "gallery-status" });
const gathering = createGallery({
  bodyId: "gathering-body",
  statusId: "gathering-status",
  extraParams: { album: GATHERING_ALBUM_PATH },
});

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let currentLang = "no";

/* --- Språk ---------------------------------------------------------------- */

function readStoredLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "no" || stored === "en") return stored;
  } catch {
    /* localStorage kan være blokkert — da faller vi bare tilbake */
  }
  const browser = (navigator.language || "").toLowerCase();
  return browser.startsWith("nb") || browser.startsWith("nn") || browser.startsWith("no")
    ? "no"
    : "en";
}

function storeLang(lang) {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignorer */
  }
}

/* --- Tema (Windows 95 / Vista) ---------------------------------------------- */

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "win95" || stored === "vista") return stored;
  } catch {
    /* localStorage kan være blokkert */
  }
  return "win95";
}

function storeTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignorer */
  }
}

function applyTheme(theme) {
  const vistaLink = $("#theme-vista-link");
  if (vistaLink) vistaLink.disabled = theme !== "vista";
  document.documentElement.dataset.theme = theme;

  const toggle = $("#theme-toggle");
  if (toggle) toggle.setAttribute("aria-pressed", String(theme === "vista"));

  storeTheme(theme);
}

/* --- Prosjektliste -------------------------------------------------------- */

function renderProjects(lang) {
  const list = $("#project-list");
  if (!list) return;
  list.textContent = "";

  for (const project of PROJECTS) {
    const item = document.createElement("a");
    item.className = "file-item" + (project.type === "link" ? " is-link" : "");
    item.href = project.url;
    item.rel = "noopener noreferrer";
    item.target = "_blank";

    const icon = document.createElement("span");
    icon.className = "file-icon";
    icon.setAttribute("aria-hidden", "true");

    const text = document.createElement("span");
    text.className = "file-text";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = project.name;
    text.append(name);

    const desc = project.desc?.[lang];
    if (desc) {
      const p = document.createElement("p");
      p.className = "file-desc";
      p.textContent = desc;
      text.append(p);
    }

    const url = document.createElement("p");
    url.className = "file-url";
    url.textContent = project.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    text.append(url);

    if (project.tags?.length) {
      const tags = document.createElement("ul");
      tags.className = "file-tags";
      for (const tag of project.tags) {
        const li = document.createElement("li");
        li.textContent = tag;
        tags.append(li);
      }
      text.append(tags);
    }

    item.append(icon, text);
    list.append(item);
  }

  const count = $("#status-count");
  if (count) count.textContent = STRINGS[lang].objects(PROJECTS.length);
}

/* --- Oversetting ---------------------------------------------------------- */

function applyLanguage(lang) {
  currentLang = lang;
  const dict = STRINGS[lang];

  document.documentElement.lang = lang === "no" ? "no" : "en";
  document.title = dict.docTitle;

  for (const node of $$("[data-i18n]")) {
    const value = dict[node.dataset.i18n];
    if (typeof value === "string") node.textContent = value;
  }

  // Menylinjen: første bokstav understrekes som i Windows 95
  for (const node of $$("[data-menu]")) {
    const label = dict[`menu.${node.dataset.menu}`] || "";
    node.textContent = "";
    const accel = document.createElement("u");
    accel.textContent = label.slice(0, 1);
    node.append(accel, document.createTextNode(label.slice(1)));
  }

  for (const button of $$(".btn-lang")) {
    const isActive = button.dataset.lang === lang;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }

  renderProjects(lang);
  gallery.setLanguage(lang);
  gathering.setLanguage(lang);
  tetris.setLanguage(lang);
  minesweeper.setLanguage(lang);
  pinball.setLanguage(lang);
  solitaire.setLanguage(lang);
  clippy.setLanguage(lang);
  updateClock();
  storeLang(lang);
}

/* --- Klokke --------------------------------------------------------------- */

function updateClock() {
  const clock = $("#clock");
  if (!clock) return;
  clock.textContent = new Date().toLocaleTimeString(LOCALES[currentLang], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* --- Klikkelyder ------------------------------------------------------------
   Syntetisert med Web Audio, ingen lydfil å laste ned — i tråd med resten
   av siden som ikke drar inn eksterne avhengigheter. */

let audioCtx = null;

function ensureAudio() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playClick() {
  const ctx = ensureAudio();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(700, now + 0.025);

  gain.gain.setValueAtTime(0.05, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.045);
}

function initSounds() {
  document.addEventListener("pointerdown", (event) => {
    if (event.target.closest(SOUND_SELECTOR)) playClick();
  });
}

/* --- Oppstart ------------------------------------------------------------- */

function init() {
  applyTheme(readStoredTheme());
  $("#theme-toggle")?.addEventListener("click", () => {
    applyTheme(document.documentElement.dataset.theme === "vista" ? "win95" : "vista");
  });

  gallery.init();
  gathering.init();
  tetris.init();
  minesweeper.init();
  pinball.init();
  solitaire.init();
  clippy.init();

  windows.init({
    windows: ["portfolio", "gallery", "gathering", "tetris", "minesweeper", "pinball", "solitaire"],
    onOpen: (name) => {
      if (name === "gallery") gallery.start();
      if (name === "gathering") gathering.start();
      if (name === "tetris") tetris.start();
    },
    onCloseIntercept: (name) => {
      if (name !== "portfolio") return false;
      $("#shutdown-modal").hidden = false;
      $("#dlg-ok").focus();
      return true;
    },
  });

  // SmugMug-galleriet skal være synlig med det samme, uten å måtte klikke ikonet.
  windows.open("gallery");

  applyLanguage(readStoredLang());
  initSounds();

  for (const button of $$(".btn-lang")) {
    button.addEventListener("click", () => applyLanguage(button.dataset.lang));
  }

  $("#dlg-ok")?.addEventListener("click", () => {
    $("#shutdown-modal").hidden = true;
    windows.forceClose("portfolio");
  });

  document.addEventListener("keydown", (event) => {
    const modal = $("#shutdown-modal");
    if (event.key === "Escape" && modal && !modal.hidden) modal.hidden = true;
  });

  updateClock();
  setInterval(updateClock, 15000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
