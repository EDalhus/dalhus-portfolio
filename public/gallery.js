/* ==========================================================================
   gallery.js — henter /api/smugmug og tegner Win95-galleriet.
   Worker-en har allerede trimmet og cachet dataene, så her er det bare DOM.
   ========================================================================== */

import { GALLERY, STRINGS, LOCALES } from "./config.js";

let data = null;
let loadPromise = null;
let activeTab = "photos";
let lang = "no";

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function formatDate(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(LOCALES[lang], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/* --- Henting -------------------------------------------------------------- */

async function load() {
  const url = `${GALLERY.endpoint}?images=${GALLERY.images}&albums=${GALLERY.albums}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!body) throw new Error(`HTTP ${res.status}`);
  return body;
}

/* --- Notiser (demo / feil) ------------------------------------------------ */

function notice(kind, title, body) {
  const box = el("div", `notice notice-${kind}`);
  const icon = el("span", "notice-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = kind === "error" ? "!" : "i";
  const text = el("div", "notice-text");
  text.append(el("strong", null, title));
  if (body) text.append(el("p", null, body));
  box.append(icon, text);
  return box;
}

/* --- Fliser --------------------------------------------------------------- */

function photoTile(image) {
  const dict = STRINGS[lang];
  const tile = image.webUri ? el("a", "tile") : el("div", "tile");
  if (image.webUri) {
    tile.href = image.webUri;
    tile.target = "_blank";
    tile.rel = "noopener noreferrer";
  }
  if (image.demo) tile.classList.add("is-demo");

  const frame = el("span", "tile-frame");
  if (image.thumb) {
    const img = el("img", "tile-img");
    img.src = image.thumb;
    img.alt = image.title || dict["gallery.untitled"];
    img.loading = "lazy";
    img.decoding = "async";
    frame.append(img);
  } else {
    frame.append(el("span", "tile-placeholder"));
  }

  const caption = el("span", "tile-caption", image.title || dict["gallery.untitled"]);
  const meta = formatDate(image.date);

  tile.append(frame, caption);
  if (meta) tile.append(el("span", "tile-meta", meta));
  return tile;
}

function albumRow(album) {
  const dict = STRINGS[lang];
  const row = album.webUri ? el("a", "album-row") : el("div", "album-row");
  if (album.webUri) {
    row.href = album.webUri;
    row.target = "_blank";
    row.rel = "noopener noreferrer";
  }
  if (album.demo) row.classList.add("is-demo");

  const cover = el("span", "album-cover");
  if (album.cover) {
    const img = el("img", "album-cover-img");
    img.src = album.cover;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    cover.append(img);
  } else {
    cover.append(el("span", "tile-placeholder"));
  }

  const text = el("span", "album-text");
  text.append(el("span", "album-name", album.title || dict["gallery.untitled"]));

  const bits = [];
  if (album.imageCount) bits.push(dict.imagesIn(album.imageCount));
  const date = formatDate(album.date);
  if (date) bits.push(date);
  if (bits.length) text.append(el("span", "album-meta", bits.join(" · ")));
  if (album.description) text.append(el("p", "album-desc", album.description));

  row.append(cover, text);
  return row;
}

/* --- Rendering ------------------------------------------------------------ */

function renderBody() {
  const dict = STRINGS[lang];
  const body = document.querySelector("#gallery-body");
  const status = document.querySelector("#gallery-status");
  if (!body) return;

  body.textContent = "";

  if (!data) {
    body.append(el("p", "gallery-message", dict["gallery.loading"]));
    if (status) status.textContent = "";
    return;
  }

  if (data.source === "error") {
    body.append(notice("error", dict["gallery.errorTitle"], data.reason || ""));
    body.append(retryButton());
    if (status) status.textContent = "";
    return;
  }

  if (data.source === "demo") {
    body.append(notice("info", dict["gallery.demoTitle"], data.reason || ""));
  }

  const items = activeTab === "photos" ? data.images || [] : data.albums || [];

  if (!items.length) {
    body.append(el("p", "gallery-message", dict["gallery.empty"]));
  } else if (activeTab === "photos") {
    const grid = el("div", "tile-grid");
    for (const image of items) grid.append(photoTile(image));
    body.append(grid);
  } else {
    const list = el("div", "album-list");
    for (const album of items) list.append(albumRow(album));
    body.append(list);
  }

  if (status) {
    status.textContent =
      activeTab === "photos" ? dict.photos(items.length) : dict.albums(items.length);
  }
}

function retryButton() {
  const wrap = el("p", "gallery-actions");
  const button = el("button", "btn", STRINGS[lang]["gallery.retry"]);
  button.type = "button";
  button.addEventListener("click", () => {
    data = null;
    loadPromise = null;
    renderBody();
    start();
  });
  wrap.append(button);
  return wrap;
}

function galleryTabs() {
  return document.querySelectorAll('.window[data-window="gallery"] [data-tab]');
}

function renderTabs() {
  const dict = STRINGS[lang];
  for (const tab of galleryTabs()) {
    const key = tab.dataset.tab;
    tab.textContent = dict[`gallery.tab.${key}`];
    const isActive = key === activeTab;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
    tab.tabIndex = isActive ? 0 : -1;
  }
}

/* --- Offentlig API -------------------------------------------------------- */

export function start() {
  if (loadPromise) return loadPromise;
  loadPromise = load()
    .then((payload) => {
      data = payload;
      if (payload.warnings?.length) {
        console.warn("[smugmug]", payload.warnings.join(" | "));
      }
    })
    .catch((error) => {
      data = { source: "error", reason: error.message, images: [], albums: [] };
    })
    .finally(renderBody);
  return loadPromise;
}

export function setLanguage(next) {
  lang = next;
  renderTabs();
  renderBody();
}

export function init() {
  for (const tab of galleryTabs()) {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      renderTabs();
      renderBody();
    });
  }
  renderTabs();
  renderBody();
}
