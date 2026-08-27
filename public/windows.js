/* ==========================================================================
   windows.js — vindusbehandler: åpne/lukke/fokusere vinduer, dra dem rundt,
   endre størrelse i hjørnene, skrivebordsikoner og Start-menyen.

   Under DESKTOP_BREAKPOINT er vinduene absolutt posisjonerte og flyttbare.
   Under den (mobil) faller alt tilbake til vanlig dokumentflyt — samme
   oppførsel som før denne modulen fantes.
   ========================================================================== */

const DESKTOP_BREAKPOINT = "(min-width: 521px)";
const MIN_WIDTH = 280;
const MIN_HEIGHT = 220;
const EDGE_MARGIN = 8;
const ICON_COLUMN_WIDTH = 92;

const DEFAULTS = {
  portfolio: { width: 720, height: 520, x: 40, y: 28 },
  gallery: { width: 1400, height: 900, x: 90, y: 30 },
};

// Vinduer uten en egen oppføring over (de dynamiske SmugMug-galleriene) får
// dette, trappet litt ned og til høyre etter rekkefølgen de kom i, så de ikke
// legger seg nøyaktig oppå hverandre.
const DYNAMIC_DEFAULT = { width: 1100, height: 820, x: 120, y: 30 };

const CORNER_DELTAS = {
  nw: (dx, dy, start) => ({ x: start.x + dx, y: start.y + dy, width: start.width - dx, height: start.height - dy }),
  ne: (dx, dy, start) => ({ x: start.x, y: start.y + dy, width: start.width + dx, height: start.height - dy }),
  sw: (dx, dy, start) => ({ x: start.x + dx, y: start.y, width: start.width - dx, height: start.height + dy }),
  se: (dx, dy, start) => ({ x: start.x, y: start.y, width: start.width + dx, height: start.height + dy }),
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const mediaQuery = window.matchMedia(DESKTOP_BREAKPOINT);
const rects = new Map();
const restoreRects = new Map();
const openState = new Map(); // navn -> for øyeblikket synlig (false ved minimert ELLER lukket)
const runningState = new Map(); // navn -> har en oppgavelinje-knapp (åpen eller minimert, men ikke lukket)

let names = [];
let desktop;
let startButton;
let startMenu;
let zCounter = 10;
let onOpen = () => {};
let onCloseIntercept = () => false;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function isDesktopMode() {
  return mediaQuery.matches;
}

function windowEl(name) {
  return $(`.window[data-window="${name}"]`);
}

function taskButtons(name) {
  return $$(`.taskbar-apps [data-window-target="${name}"]`);
}

/* --- Posisjon / størrelse -------------------------------------------------- */

function defaultRect(name) {
  let base = DEFAULTS[name];
  if (!base) {
    const step = (Math.max(0, names.indexOf(name)) % 6) * 26;
    base = {
      ...DYNAMIC_DEFAULT,
      x: DYNAMIC_DEFAULT.x + step,
      y: DYNAMIC_DEFAULT.y + step,
    };
  }
  const bounds = desktop.getBoundingClientRect();
  const width = Math.min(base.width, Math.max(MIN_WIDTH, bounds.width - EDGE_MARGIN * 2));
  const height = Math.min(base.height, Math.max(MIN_HEIGHT, window.innerHeight - 160));
  // Ikke la et bredt standardvindu klemmes så langt til venstre at det
  // dekker skrivebordsikonene helt.
  const maxX = Math.max(0, bounds.width - width);
  const minX = Math.min(ICON_COLUMN_WIDTH, maxX);
  const x = clamp(base.x, minX, maxX);
  const y = Math.max(0, base.y);
  return { x, y, width, height };
}

function ensureRect(name) {
  if (!rects.has(name)) rects.set(name, defaultRect(name));
  return rects.get(name);
}

function applyRect(name) {
  if (!isDesktopMode()) return;
  const win = windowEl(name);
  const rect = rects.get(name);
  if (!win || !rect) return;
  win.style.left = `${rect.x}px`;
  win.style.top = `${rect.y}px`;
  win.style.width = `${rect.width}px`;
  win.style.height = `${rect.height}px`;
}

function clearInlineRect(name) {
  const win = windowEl(name);
  if (!win) return;
  win.style.left = "";
  win.style.top = "";
  win.style.width = "";
  win.style.height = "";
}

function clampRectToDesktop(name) {
  const rect = rects.get(name);
  if (!rect) return;
  const bounds = desktop.getBoundingClientRect();
  rect.width = Math.min(rect.width, Math.max(MIN_WIDTH, bounds.width - EDGE_MARGIN * 2));
  rect.x = clamp(rect.x, 0, Math.max(0, bounds.width - rect.width));
  rect.y = Math.max(0, rect.y);
}

/* --- Fokus / z-index --------------------------------------------------------- */

function focus(name) {
  const win = windowEl(name);
  if (!win) return;
  zCounter += 1;
  win.style.zIndex = String(zCounter);
  for (const other of $$(".window[data-window]")) {
    other.classList.toggle("is-focused", other === win);
  }
}

/* --- Åpne / lukke / minimere / maksimere -------------------------------------- */

function setVisible(name, visible) {
  const win = windowEl(name);
  if (!win) return;
  const wasOpen = openState.get(name) === true;
  win.hidden = !visible;
  openState.set(name, visible);

  if (visible && !runningState.get(name)) {
    runningState.set(name, true);
    for (const button of taskButtons(name)) button.hidden = false;
  }
  for (const button of taskButtons(name)) button.classList.toggle("is-active", visible);

  if (visible) {
    ensureRect(name);
    applyRect(name);
    focus(name);
    if (!wasOpen) onOpen(name);
  }
}

export function open(name) {
  setVisible(name, true);
}

function minimize(name) {
  setVisible(name, false);
}

function performClose(name) {
  setVisible(name, false);
  runningState.set(name, false);
  for (const button of taskButtons(name)) button.hidden = true;
}

export function close(name) {
  if (onCloseIntercept(name)) return;
  performClose(name);
}

/** Lukker uten å spørre onCloseIntercept — for når intercepten selv (etter
 * en bekreftelsesdialog e.l.) har bestemt at vinduet faktisk skal lukkes. */
export function forceClose(name) {
  performClose(name);
}

export function toggle(name) {
  const win = windowEl(name);
  if (!win) return;
  setVisible(name, win.hidden);
}

export function isOpen(name) {
  return openState.get(name) === true;
}

function toggleMaximize(name) {
  const win = windowEl(name);
  if (!win) return;
  const isMax = win.classList.toggle("is-maximized");
  if (!isDesktopMode()) return;

  if (isMax) {
    restoreRects.set(name, { ...ensureRect(name) });
    const bounds = desktop.getBoundingClientRect();
    rects.set(name, {
      x: EDGE_MARGIN,
      y: EDGE_MARGIN,
      width: bounds.width - EDGE_MARGIN * 2,
      height: window.innerHeight - 160,
    });
  } else {
    const restore = restoreRects.get(name);
    if (restore) rects.set(name, restore);
  }
  applyRect(name);
}

/* --- Dra via tittellinjen ----------------------------------------------------- */

function attachDrag(name) {
  const win = windowEl(name);
  const bar = win?.querySelector(".title-bar");
  if (!win || !bar) return;

  bar.addEventListener("pointerdown", (event) => {
    if (!isDesktopMode() || win.classList.contains("is-maximized")) return;
    if (event.target.closest(".tb-btn")) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const rect = ensureRect(name);
    const startRect = { ...rect };
    const startX = event.clientX;
    const startY = event.clientY;

    win.classList.add("is-dragging");
    focus(name);
    bar.setPointerCapture(event.pointerId);
    event.preventDefault();

    const onMove = (moveEvent) => {
      const bounds = desktop.getBoundingClientRect();
      rect.x = clamp(startRect.x + (moveEvent.clientX - startX), 0, Math.max(0, bounds.width - rect.width));
      rect.y = Math.max(0, startRect.y + (moveEvent.clientY - startY));
      applyRect(name);
    };
    const onUp = (upEvent) => {
      win.classList.remove("is-dragging");
      bar.releasePointerCapture(upEvent.pointerId);
      bar.removeEventListener("pointermove", onMove);
      bar.removeEventListener("pointerup", onUp);
    };

    bar.addEventListener("pointermove", onMove);
    bar.addEventListener("pointerup", onUp, { once: true });
  });
}

/* --- Endre størrelse i hjørnene ----------------------------------------------- */

function attachResize(name) {
  const win = windowEl(name);
  if (!win) return;

  for (const handle of $$(".resize-handle", win)) {
    const corner = handle.dataset.resize;

    handle.addEventListener("pointerdown", (event) => {
      if (!isDesktopMode() || win.classList.contains("is-maximized")) return;
      event.stopPropagation();
      event.preventDefault();

      const rect = ensureRect(name);
      const startRect = { ...rect };
      const startX = event.clientX;
      const startY = event.clientY;

      win.classList.add("is-resizing");
      focus(name);
      handle.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        const bounds = desktop.getBoundingClientRect();
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        const next = CORNER_DELTAS[corner](dx, dy, startRect);

        next.width = Math.max(MIN_WIDTH, next.width);
        next.height = Math.max(MIN_HEIGHT, next.height);
        if (corner === "nw" || corner === "sw") next.x = startRect.x + startRect.width - next.width;
        if (corner === "nw" || corner === "ne") next.y = startRect.y + startRect.height - next.height;

        next.x = clamp(next.x, 0, Math.max(0, bounds.width - next.width));
        next.y = Math.max(0, next.y);

        Object.assign(rect, next);
        applyRect(name);
      };
      const onUp = (upEvent) => {
        win.classList.remove("is-resizing");
        handle.releasePointerCapture(upEvent.pointerId);
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp, { once: true });
    });
  }
}

/* --- Skrivebordsikoner --------------------------------------------------------- */

function attachDesktopIcons() {
  // Delegert, så ikoner som legges til senere (de dynamiske SmugMug-galleriene)
  // virker uten at de må kobles opp enkeltvis.
  const container = $(".desktop-icons");
  if (!container) return;
  container.addEventListener("click", (event) => {
    const icon = event.target.closest(".desktop-icon");
    if (!icon || !container.contains(icon)) return;
    for (const other of $$(".desktop-icon")) other.classList.toggle("is-selected", other === icon);
    open(icon.dataset.iconTarget);
  });
}

/* --- Start-meny ----------------------------------------------------------------- */

function closeStartMenu() {
  startMenu.hidden = true;
  startButton.setAttribute("aria-expanded", "false");
}

function attachStartMenu() {
  startButton.addEventListener("click", () => {
    const willOpen = startMenu.hidden;
    startMenu.hidden = !willOpen;
    startButton.setAttribute("aria-expanded", String(willOpen));
  });

  startMenu.addEventListener("click", (event) => {
    const item = event.target.closest(".start-menu-item");
    if (!item) return;
    open(item.dataset.windowTarget);
    closeStartMenu();
  });

  document.addEventListener("pointerdown", (event) => {
    if (startMenu.hidden) return;
    if (event.target.closest(".start-menu") || event.target.closest(".start-button")) return;
    closeStartMenu();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !startMenu.hidden) closeStartMenu();
  });
}

/* --- Oppsett ---------------------------------------------------------------------- */

function syncDesktopMode() {
  desktop.classList.toggle("is-desktop-mode", isDesktopMode());
  if (isDesktopMode()) {
    for (const name of names) {
      if (isOpen(name)) {
        ensureRect(name);
        applyRect(name);
      }
    }
  } else {
    for (const name of names) clearInlineRect(name);
  }
}

/**
 * Kobler opp ett vindu: knappene i tittellinjen, dra, endre størrelse og den
 * tilhørende oppgavelinje-knappen. Trygg å kalle etter init() også — de
 * dynamiske SmugMug-galleriene bruker den når seksjonen deres er lagt i DOM.
 */
export function mountWindow(name) {
  const win = windowEl(name);
  if (!win || names.includes(name)) return;
  names.push(name);
  openState.set(name, false);
  runningState.set(name, false);

  for (const button of taskButtons(name)) {
    button.hidden = true;
    button.addEventListener("click", () => toggle(name));
  }

  win.querySelector('[data-action="minimize"]')?.addEventListener("click", () => minimize(name));
  win.querySelector('[data-action="maximize"]')?.addEventListener("click", () => toggleMaximize(name));
  win.querySelector('[data-action="close"]')?.addEventListener("click", () => close(name));
  win.addEventListener("pointerdown", () => focus(name));

  attachDrag(name);
  attachResize(name);
}

export function init({ windows, onOpen: onOpenHandler, onCloseIntercept: onCloseHandler }) {
  names = [];
  desktop = $(".desktop");
  startButton = $("#start-button");
  startMenu = $("#start-menu");
  onOpen = onOpenHandler || onOpen;
  onCloseIntercept = onCloseHandler || onCloseIntercept;

  for (const name of windows) mountWindow(name);

  attachDesktopIcons();
  attachStartMenu();
  syncDesktopMode();

  mediaQuery.addEventListener("change", syncDesktopMode);
  window.addEventListener("resize", () => {
    if (!isDesktopMode()) return;
    for (const name of names) {
      clampRectToDesktop(name);
      applyRect(name);
    }
  });
}
