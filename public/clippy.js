/* ==========================================================================
   clippy.js — den gamle Office-assistenten, gjenopplivet som en frittstående
   widget på skrivebordet. Ikke en del av windows.js sitt vindussystem: han
   flyter over alt, kan dras rundt, og husker om du har jaget ham vekk.
   ========================================================================== */

import { CLIPPY_TIPS } from "./config.js";

const STORAGE_KEY = "dalhus.clippy.dismissed";
const ENTRANCE_DELAY_MS = 2500;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let lang = "no";
let widget, bubble, tipText, trayButton;
let tipIndex = 0;
let hasEntered = false;
let pos = null; // { x, y } i px fra venstre/topp, satt når man har dratt ham

function readDismissed() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function storeDismissed(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, "1");
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignorer */
  }
}

function currentTips() {
  return CLIPPY_TIPS[lang] || CLIPPY_TIPS.no;
}

function showTip(index) {
  const tips = currentTips();
  tipIndex = ((index % tips.length) + tips.length) % tips.length;
  if (tipText) tipText.textContent = tips[tipIndex];
  if (bubble) bubble.hidden = false;
}

function nextTip() {
  showTip(tipIndex + 1);
}

function applyPosition() {
  if (!widget || !pos) return;
  widget.style.left = `${pos.x}px`;
  widget.style.top = `${pos.y}px`;
  widget.style.right = "auto";
  widget.style.bottom = "auto";
}

function attachDrag() {
  const body = widget.querySelector(".clippy-body");
  let dragged = false;

  body.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const rect = widget.getBoundingClientRect();
    pos = { x: rect.left, y: rect.top };
    applyPosition();

    const startX = event.clientX;
    const startY = event.clientY;
    const startPos = { ...pos };
    dragged = false;
    body.setPointerCapture(event.pointerId);

    const onMove = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
      pos = {
        x: Math.max(0, Math.min(window.innerWidth - widget.offsetWidth, startPos.x + dx)),
        y: Math.max(0, Math.min(window.innerHeight - widget.offsetHeight, startPos.y + dy)),
      };
      applyPosition();
    };
    const onUp = (upEvent) => {
      body.releasePointerCapture(upEvent.pointerId);
      body.removeEventListener("pointermove", onMove);
      body.removeEventListener("pointerup", onUp);
      if (!dragged) nextTip();
    };

    body.addEventListener("pointermove", onMove);
    body.addEventListener("pointerup", onUp, { once: true });
  });
}

function dismiss() {
  widget.hidden = true;
  storeDismissed(true);
  if (trayButton) trayButton.hidden = false;
}

function bringBack() {
  widget.hidden = false;
  storeDismissed(false);
  if (trayButton) trayButton.hidden = true;
  showTip(tipIndex);
}

function build() {
  widget = el("div", "clippy");
  widget.hidden = true;

  bubble = el("div", "clippy-bubble");
  tipText = el("p", "clippy-bubble-text");
  const dismissBtn = el("button", "clippy-bubble-close", "×");
  dismissBtn.type = "button";
  dismissBtn.setAttribute("aria-label", "×");
  dismissBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    dismiss();
  });
  bubble.append(tipText, dismissBtn);

  const body = el("div", "clippy-body");
  const face = document.createElement("img");
  face.className = "clippy-face";
  face.src = "/clippy.png";
  face.alt = "Clippy";
  face.draggable = false;
  body.append(face);

  widget.append(bubble, body);
  document.body.append(widget);

  attachDrag();
}

/* --- Offentlig API ----------------------------------------------------------- */

export function init() {
  build();

  trayButton = document.querySelector("#clippy-toggle");
  trayButton?.addEventListener("click", bringBack);

  if (!readDismissed()) {
    window.setTimeout(() => {
      hasEntered = true;
      widget.hidden = false;
      showTip(0);
    }, ENTRANCE_DELAY_MS);
  } else if (trayButton) {
    trayButton.hidden = false;
  }
}

export function setLanguage(next) {
  lang = next;
  if (hasEntered && bubble && !bubble.hidden) showTip(tipIndex);
}
