/* ==========================================================================
   folder-galleries.js — ett skrivebordsikon + vindu per galleri i en eller
   flere SmugMug-mapper.

   Worker-en lister galleriene i en mappe via /api/smugmug?folder=<sti>. For
   hvert galleri bygger vi det samme oppsettet index.html har for et fast
   galleri-vindu (ikon, vindu, oppgavelinje-knapp, Start-meny-linje) og kobler
   det på vindusbehandleren med windows.mountWindow(). Legger du til et galleri
   i SmugMug, dukker det opp her av seg selv ved neste lasting.
   ========================================================================== */

import { createGallery } from "./gallery.js";
import { STRINGS } from "./config.js";
import * as windows from "./windows.js";

const galleries = new Map(); // vindusnavn -> galleri-kontroller fra createGallery()
let currentLang = "no";

/** Gjør en album-sti om til et stabilt, unikt vindusnavn: /FA/KANDU/TG26H → "gal-fa-kandu-tg26h". */
function windowName(path, taken) {
  const slug = path
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let name = `gal-${slug || "galleri"}`;
  for (let n = 2; taken.has(name); n += 1) name = `gal-${slug}-${n}`;
  taken.add(name);
  return name;
}

function buildIcon(name, title, thumb) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "desktop-icon";
  button.dataset.iconTarget = name;

  const glyph = document.createElement("span");
  glyph.className = "desktop-icon-glyph desktop-icon-glyph-photo";
  glyph.setAttribute("aria-hidden", "true");
  if (thumb) {
    glyph.classList.add("desktop-icon-glyph-thumb");
    glyph.style.backgroundImage = `url("${encodeURI(thumb)}")`;
  }

  const label = document.createElement("span");
  label.className = "desktop-icon-label";
  label.textContent = title;

  button.append(glyph, label);
  return button;
}

/** Knapp med foto-ikon + tekst, brukt både i oppgavelinja og Start-menyen. */
function trayButton(name, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.windowTarget = name;

  const icon = document.createElement("span");
  icon.className = "task-icon task-icon-photo";
  icon.setAttribute("aria-hidden", "true");

  const text = document.createElement("span");
  text.textContent = title;

  button.append(icon, text);
  return button;
}

function buildTaskButton(name, title) {
  const button = trayButton(name, title);
  button.className = "btn task-button";
  button.hidden = true;
  return button;
}

function buildStartItem(name, title) {
  const li = document.createElement("li");
  li.setAttribute("role", "none");
  const button = trayButton(name, title);
  button.className = "start-menu-item";
  button.setAttribute("role", "menuitem");
  li.append(button);
  return li;
}

function buildWindow(name, title) {
  const section = document.createElement("section");
  section.className = "window";
  section.dataset.window = name;
  section.setAttribute("role", "region");
  section.setAttribute("aria-label", title);
  section.hidden = true;

  section.innerHTML = `
    <span class="resize-handle resize-nw" data-resize="nw" aria-hidden="true"></span>
    <span class="resize-handle resize-ne" data-resize="ne" aria-hidden="true"></span>
    <span class="resize-handle resize-sw" data-resize="sw" aria-hidden="true"></span>
    <span class="resize-handle resize-se" data-resize="se" aria-hidden="true"></span>
    <div class="title-bar">
      <span class="title-bar-icon title-bar-icon-photo" aria-hidden="true"></span>
      <h2 class="title-bar-text"></h2>
      <div class="title-bar-controls">
        <button type="button" class="tb-btn" data-action="minimize" aria-label="Minimer"><span class="glyph glyph-min" aria-hidden="true"></span></button>
        <button type="button" class="tb-btn" data-action="maximize" aria-label="Maksimer"><span class="glyph glyph-max" aria-hidden="true"></span></button>
        <button type="button" class="tb-btn" data-action="close" aria-label="Lukk"><span class="glyph glyph-close" aria-hidden="true"></span></button>
      </div>
    </div>
    <div class="window-body">
      <div class="tab-panel field-sunken"></div>
    </div>
    <div class="status-bar">
      <span class="status-field"></span>
      <span class="status-field" data-i18n="status.hint"></span>
    </div>`;

  section.querySelector(".title-bar-text").textContent = title;
  section.querySelector(".tab-panel").id = `${name}-body`;

  const statusFields = section.querySelectorAll(".status-bar .status-field");
  statusFields[0].id = `${name}-status`;
  statusFields[1].textContent = STRINGS[currentLang]["status.hint"];

  return section;
}

async function fetchFolder(folderPath) {
  try {
    const res = await fetch(`/api/smugmug?folder=${encodeURIComponent(folderPath)}`, {
      headers: { accept: "application/json" },
    });
    const payload = await res.json();
    if (payload?.warnings?.length) console.warn(`[gallerier ${folderPath}]`, payload.warnings.join(" | "));
    return Array.isArray(payload?.albums) ? payload.albums : [];
  } catch (error) {
    console.warn(`[gallerier ${folderPath}] kunne ikke hente mappe:`, error.message);
    return [];
  }
}

/**
 * Henter mappe-listene og bygger et ikon + vindu per galleri.
 * @param {string[]} folderPaths — SmugMug-mappestier, f.eks. ["/FA/SDOK", "/FA/KANDU"]
 */
export async function init(folderPaths) {
  const lists = await Promise.all(folderPaths.map(fetchFolder));
  const albums = lists.flat().filter((album) => album?.path);
  if (!albums.length) return;

  const iconContainer = document.querySelector(".desktop-icons");
  const taskbarApps = document.querySelector(".taskbar-apps");
  const startList = document.querySelector(".start-menu-list");
  const desktop = document.querySelector(".desktop");
  const modal = document.querySelector("#shutdown-modal");
  if (!iconContainer || !taskbarApps || !startList || !desktop) return;

  const taken = new Set(["portfolio", "gallery"]);
  const seenPaths = new Set();

  for (const album of albums) {
    if (seenPaths.has(album.path)) continue; // samme galleri via to mapper
    seenPaths.add(album.path);

    const name = windowName(album.path, taken);
    const title = album.name || album.path.split("/").filter(Boolean).pop();

    desktop.insertBefore(buildWindow(name, title), modal);
    iconContainer.append(buildIcon(name, title, album.thumb));
    taskbarApps.append(buildTaskButton(name, title));
    startList.append(buildStartItem(name, title));

    const gallery = createGallery({
      bodyId: `${name}-body`,
      statusId: `${name}-status`,
      extraParams: { album: album.path },
    });
    gallery.init();
    gallery.setLanguage(currentLang);
    galleries.set(name, gallery);

    windows.mountWindow(name);
  }
}

/** Kalles fra windows.init()-onOpen: last galleriet første gang vinduet åpnes. */
export function start(name) {
  galleries.get(name)?.start();
}

export function has(name) {
  return galleries.has(name);
}

export function setLanguage(lang) {
  currentLang = lang;
  for (const gallery of galleries.values()) gallery.setLanguage(lang);
}
