/* ==========================================================================
   app.js — skallet: språk, vinduer, oppgavelinje, klokke.
   Innhold ligger i config.js, galleriet i gallery.js.
   ========================================================================== */

import { PROJECTS, STRINGS, LOCALES } from "./config.js";
import * as gallery from "./gallery.js";

const STORAGE_KEY = "dalhus.lang";

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

/* --- Vindushåndtering ----------------------------------------------------- */

function windowFor(name) {
  return $(`.window[data-window="${name}"]`);
}

function taskButtonFor(name) {
  return $(`[data-window-target="${name}"]`);
}

function setWindowVisible(name, visible) {
  const win = windowFor(name);
  if (!win) return;
  win.hidden = !visible;
  taskButtonFor(name)?.classList.toggle("is-active", visible);
}

function initWindowControls() {
  for (const win of $$(".window[data-window]")) {
    const name = win.dataset.window;

    win.querySelector('[data-action="minimize"]')?.addEventListener("click", () => {
      setWindowVisible(name, false);
    });

    win.querySelector('[data-action="maximize"]')?.addEventListener("click", () => {
      win.classList.toggle("is-maximized");
    });

    win.querySelector('[data-action="close"]')?.addEventListener("click", () => {
      if (name === "portfolio") {
        $("#shutdown-modal").hidden = false;
        $("#dlg-ok").focus();
      } else {
        setWindowVisible(name, false);
      }
    });
  }

  for (const button of $$("[data-window-target]")) {
    button.addEventListener("click", () => {
      const name = button.dataset.windowTarget;
      setWindowVisible(name, windowFor(name)?.hidden === true);
    });
  }
}

/* --- Oppstart ------------------------------------------------------------- */

function init() {
  gallery.init();
  applyLanguage(readStoredLang());

  for (const button of $$(".btn-lang")) {
    button.addEventListener("click", () => applyLanguage(button.dataset.lang));
  }

  initWindowControls();

  $("#dlg-ok")?.addEventListener("click", () => {
    $("#shutdown-modal").hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    const modal = $("#shutdown-modal");
    if (event.key === "Escape" && modal && !modal.hidden) modal.hidden = true;
  });

  $("#start-button")?.addEventListener("click", () => {
    setWindowVisible("portfolio", true);
    setWindowVisible("gallery", true);
    windowFor("portfolio")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  updateClock();
  setInterval(updateClock, 15000);

  // Galleriet lastes først når vinduet faktisk er i nærheten av skjermen.
  const galleryWindow = windowFor("gallery");
  if (galleryWindow && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          gallery.start();
        }
      },
      { rootMargin: "200px" },
    );
    observer.observe(galleryWindow);
  } else {
    gallery.start();
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
