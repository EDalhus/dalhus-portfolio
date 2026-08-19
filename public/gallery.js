/* ==========================================================================
   gallery.js — henter /api/smugmug og tegner Win95-galleriet.
   Worker-en har allerede trimmet og cachet dataene, så her er det bare DOM.
   Klikk på et bilde åpner en lokal, Win95-stil forhåndsvisning i stedet for
   å hoppe til SmugMug direkte.
   ========================================================================== */

import { GALLERY, STRINGS, LOCALES } from "./config.js";

let data = null;
let loadPromise = null;
let loadingMore = false;
let lang = "no";

let contentEl;
let sentinelEl;
let sentinelObserver;

let previewBackdrop;
let previewTitleEl;
let previewImageEl;
let previewCounterEl;
let previewMetaEl;
let previewOpenLinkEl;
let previewIndex = -1;

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

async function fetchPage(count, offset) {
  const url = `${GALLERY.endpoint}?images=${count}&offset=${offset}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  const body = await res.json().catch(() => null);
  if (!body) throw new Error(`HTTP ${res.status}`);
  return body;
}

async function loadMore() {
  if (loadingMore || !data || data.source !== "live" || !data.hasMore) return;
  loadingMore = true;
  renderBody();

  try {
    const offset = data.images.length;
    const body = await fetchPage(GALLERY.pageSize, offset);
    data.images.push(...(body.images || []));
    data.hasMore = Boolean(body.hasMore);
    if (body.warnings?.length) console.warn("[smugmug]", body.warnings.join(" | "));
  } catch (error) {
    console.warn("[smugmug] kunne ikke hente flere bilder:", error.message);
  } finally {
    loadingMore = false;
    renderBody();
  }
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

function photoTile(image, index) {
  const dict = STRINGS[lang];
  const tile = el("button", "tile");
  tile.type = "button";

  if (image.demo) {
    tile.classList.add("is-demo");
    tile.disabled = true;
  } else {
    tile.addEventListener("click", () => openPreview(index));
  }

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

/* --- Rendering ------------------------------------------------------------ */

function renderBody() {
  const dict = STRINGS[lang];
  const status = document.querySelector("#gallery-status");
  if (!contentEl) return;

  contentEl.textContent = "";

  if (!data) {
    contentEl.append(el("p", "gallery-message", dict["gallery.loading"]));
    if (status) status.textContent = "";
    updateSentinel();
    return;
  }

  if (data.source === "error") {
    contentEl.append(notice("error", dict["gallery.errorTitle"], data.reason || ""));
    contentEl.append(retryButton());
    if (status) status.textContent = "";
    updateSentinel();
    return;
  }

  if (data.source === "demo") {
    contentEl.append(notice("info", dict["gallery.demoTitle"], data.reason || ""));
  }

  const images = data.images || [];

  if (!images.length) {
    contentEl.append(el("p", "gallery-message", dict["gallery.empty"]));
  } else {
    const grid = el("div", "tile-grid");
    images.forEach((image, index) => grid.append(photoTile(image, index)));
    contentEl.append(grid);
  }

  if (loadingMore) {
    contentEl.append(el("p", "gallery-loading-more", dict["gallery.loadingMore"]));
  }

  if (status) status.textContent = dict.photos(images.length);
  updateSentinel();
}

function updateSentinel() {
  if (!sentinelEl) return;
  sentinelEl.hidden = !(data && data.source === "live" && data.hasMore !== false);
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

/* --- Forhåndsvisning -------------------------------------------------------- */

function buildPreviewModal() {
  const backdrop = el("div", "modal-backdrop preview-backdrop");
  backdrop.hidden = true;
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) closePreview();
  });

  const win = el("div", "window preview-window");
  win.setAttribute("role", "dialog");
  win.setAttribute("aria-modal", "true");

  const titleBar = el("div", "title-bar");
  const icon = el("span", "title-bar-icon title-bar-icon-photo");
  icon.setAttribute("aria-hidden", "true");
  previewTitleEl = el("h2", "title-bar-text");
  const controls = el("div", "title-bar-controls");
  const closeBtn = el("button", "tb-btn");
  closeBtn.type = "button";
  const closeGlyph = el("span", "glyph glyph-close");
  closeGlyph.setAttribute("aria-hidden", "true");
  closeBtn.append(closeGlyph);
  closeBtn.addEventListener("click", closePreview);
  controls.append(closeBtn);
  titleBar.append(icon, previewTitleEl, controls);

  const body = el("div", "window-body preview-body");
  const prevBtn = el("button", "preview-nav preview-prev", "‹");
  prevBtn.type = "button";
  prevBtn.addEventListener("click", () => stepPreview(-1));
  const nextBtn = el("button", "preview-nav preview-next", "›");
  nextBtn.type = "button";
  nextBtn.addEventListener("click", () => stepPreview(1));

  previewImageEl = document.createElement("img");
  previewImageEl.className = "preview-image";

  body.append(prevBtn, previewImageEl, nextBtn);

  const statusBar = el("div", "status-bar");
  previewCounterEl = el("span", "status-field");
  previewMetaEl = el("span", "status-field");
  previewOpenLinkEl = document.createElement("a");
  previewOpenLinkEl.className = "status-field preview-open-link";
  previewOpenLinkEl.target = "_blank";
  previewOpenLinkEl.rel = "noopener noreferrer";
  statusBar.append(previewCounterEl, previewMetaEl, previewOpenLinkEl);

  win.append(titleBar, body, statusBar);
  backdrop.append(win);
  document.body.append(backdrop);

  previewBackdrop = backdrop;
  applyPreviewChrome();
}

function applyPreviewChrome() {
  const dict = STRINGS[lang];
  previewBackdrop?.querySelector(".tb-btn")?.setAttribute("aria-label", dict["gallery.close"]);
  previewBackdrop?.querySelector(".preview-prev")?.setAttribute("aria-label", dict["gallery.prev"]);
  previewBackdrop?.querySelector(".preview-next")?.setAttribute("aria-label", dict["gallery.next"]);
  if (previewOpenLinkEl) previewOpenLinkEl.textContent = dict["gallery.openOriginal"];
}

function renderPreview() {
  const dict = STRINGS[lang];
  const images = data?.images || [];
  const image = images[previewIndex];
  if (!image) return;

  previewTitleEl.textContent = image.title || dict["gallery.untitled"];
  previewImageEl.src = image.display || image.thumb || "";
  previewImageEl.alt = image.title || dict["gallery.untitled"];

  previewMetaEl.textContent = formatDate(image.date);

  if (image.webUri) {
    previewOpenLinkEl.href = image.webUri;
    previewOpenLinkEl.hidden = false;
  } else {
    previewOpenLinkEl.removeAttribute("href");
    previewOpenLinkEl.hidden = true;
  }
  previewOpenLinkEl.textContent = dict["gallery.openOriginal"];

  previewCounterEl.textContent = `${previewIndex + 1} / ${images.length}`;
}

function openPreview(index) {
  if (!previewBackdrop) return;
  previewIndex = index;
  renderPreview();
  previewBackdrop.hidden = false;
}

function closePreview() {
  if (!previewBackdrop) return;
  previewBackdrop.hidden = true;
  previewIndex = -1;
}

function stepPreview(delta) {
  const images = data?.images || [];
  if (!images.length) return;
  previewIndex = (previewIndex + delta + images.length) % images.length;
  renderPreview();
}

function handlePreviewKeydown(event) {
  if (!previewBackdrop || previewBackdrop.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closePreview();
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    stepPreview(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    stepPreview(1);
  }
}

/* --- Offentlig API -------------------------------------------------------- */

export function start() {
  if (loadPromise) return loadPromise;
  loadPromise = fetchPage(GALLERY.images, 0)
    .then((payload) => {
      data = payload;
      if (payload.warnings?.length) {
        console.warn("[smugmug]", payload.warnings.join(" | "));
      }
    })
    .catch((error) => {
      data = { source: "error", reason: error.message, images: [] };
    })
    .finally(renderBody);
  return loadPromise;
}

export function setLanguage(next) {
  lang = next;
  renderBody();
  applyPreviewChrome();
  if (previewBackdrop && !previewBackdrop.hidden) renderPreview();
}

function buildScaffold() {
  const root = document.querySelector("#gallery-body");
  if (!root) return;

  contentEl = el("div", "gallery-content");
  sentinelEl = el("div", "gallery-sentinel");
  sentinelEl.hidden = true;
  root.append(contentEl, sentinelEl);

  sentinelObserver = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    },
    { rootMargin: "400px" },
  );
  sentinelObserver.observe(sentinelEl);
}

export function init() {
  buildScaffold();
  buildPreviewModal();
  document.addEventListener("keydown", handlePreviewKeydown);
  renderBody();
}
