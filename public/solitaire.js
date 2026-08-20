/* ==========================================================================
   solitaire.js — klassisk Kabal (Klondike). Rent lokalt, ingen server-data.

   Interaksjon er trykk-for-å-velge / trykk-for-å-flytte (ikke dra-og-slipp),
   slik at det fungerer likt med mus og med touch. Dobbeltklikk/dobbelttrykk
   sender et kort til et gyldig fundament hvis mulig.
   ========================================================================== */

import { SOLITAIRE, STRINGS } from "./config.js";

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const COLUMNS = 7;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const isRed = (suit) => suit === "♥" || suit === "♦";
const rankValue = (rank) => RANKS.indexOf(rank) + 1;

let lang = "no";
let root, statusEl, newGameBtn;
let stockEl, wasteEl, foundationEls = {}, tableauEls = [];

let stock = [];
let waste = [];
let foundations = { "♠": [], "♥": [], "♦": [], "♣": [] };
let tableau = [];
let selection = null; // { type: "waste" } | { type: "tableau", col, index }
let moves = 0;
let won = false;

/* --- Kortstokk --------------------------------------------------------- */

function freshDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) deck.push({ suit, rank });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function deal() {
  const deck = freshDeck();
  stock = [];
  waste = [];
  foundations = { "♠": [], "♥": [], "♦": [], "♣": [] };
  tableau = Array.from({ length: COLUMNS }, () => []);
  selection = null;
  moves = 0;
  won = false;

  for (let col = 0; col < COLUMNS; col++) {
    for (let row = 0; row <= col; row++) {
      const card = deck.pop();
      tableau[col].push({ card, faceUp: row === col });
    }
  }
  for (const card of deck) stock.push(card);
}

/* --- Hjelpere for valg og flytting -------------------------------------- */

function isValidSequence(cards) {
  for (let i = 0; i < cards.length - 1; i++) {
    const a = cards[i];
    const b = cards[i + 1];
    if (rankValue(a.rank) - 1 !== rankValue(b.rank)) return false;
    if (isRed(a.suit) === isRed(b.suit)) return false;
  }
  return true;
}

function clearSelection() {
  selection = null;
}

function getSelectionCards() {
  if (!selection) return [];
  if (selection.type === "waste") return waste.length ? [waste[waste.length - 1]] : [];
  const col = tableau[selection.col];
  return col.slice(selection.index).map((entry) => entry.card);
}

function removeSelectionFromSource() {
  if (!selection) return;
  if (selection.type === "waste") {
    waste.pop();
    return;
  }
  const col = tableau[selection.col];
  tableau[selection.col] = col.slice(0, selection.index);
  const newTop = tableau[selection.col][tableau[selection.col].length - 1];
  if (newTop && !newTop.faceUp) newTop.faceUp = true;
}

function tryMoveToTableau(destCol) {
  if (!selection) return false;
  const cards = getSelectionCards();
  if (!cards.length) return false;
  const col = tableau[destCol];
  const destTop = col.length ? col[col.length - 1] : null;
  const moving = cards[0];

  if (destTop) {
    if (!destTop.faceUp) return false;
    if (rankValue(destTop.card.rank) - 1 !== rankValue(moving.rank)) return false;
    if (isRed(destTop.card.suit) === isRed(moving.suit)) return false;
  } else if (rankValue(moving.rank) !== 13) {
    return false;
  }

  if (selection.type === "tableau" && selection.col === destCol) return false;

  removeSelectionFromSource();
  for (const card of cards) col.push({ card, faceUp: true });
  moves += 1;
  clearSelection();
  return true;
}

function tryMoveToFoundation(suit) {
  if (!selection) return false;
  const cards = getSelectionCards();
  if (cards.length !== 1) return false;
  const card = cards[0];
  if (card.suit !== suit) return false;
  const pile = foundations[suit];
  const topRank = pile.length ? rankValue(pile[pile.length - 1].rank) : 0;
  if (rankValue(card.rank) !== topRank + 1) return false;

  removeSelectionFromSource();
  pile.push(card);
  moves += 1;
  clearSelection();
  checkWin();
  return true;
}

function autoToFoundation(sourceType, colIndex) {
  let card = null;
  if (sourceType === "waste") {
    if (waste.length) card = waste[waste.length - 1];
  } else if (sourceType === "tableau") {
    const col = tableau[colIndex];
    const top = col[col.length - 1];
    if (top && top.faceUp) card = top.card;
  }
  if (!card) return false;

  const pile = foundations[card.suit];
  const topRank = pile.length ? rankValue(pile[pile.length - 1].rank) : 0;
  if (rankValue(card.rank) !== topRank + 1) return false;

  if (sourceType === "waste") {
    waste.pop();
  } else {
    const col = tableau[colIndex];
    col.pop();
    const newTop = col[col.length - 1];
    if (newTop && !newTop.faceUp) newTop.faceUp = true;
  }
  pile.push(card);
  moves += 1;
  clearSelection();
  checkWin();
  return true;
}

function drawFromStock() {
  clearSelection();
  if (stock.length) {
    waste.push(stock.pop());
    moves += 1;
    return;
  }
  if (!waste.length) return;
  stock = waste.reverse();
  waste = [];
  moves += 1;
}

function checkWin() {
  won = SUITS.every((suit) => foundations[suit].length === RANKS.length);
}

/* --- Klikk-håndtering ---------------------------------------------------- */

function onWasteClick() {
  if (selection?.type === "waste") {
    clearSelection();
  } else if (waste.length) {
    selection = { type: "waste" };
  } else {
    clearSelection();
  }
  render();
}

function onFoundationClick(suit) {
  if (selection) tryMoveToFoundation(suit);
  render();
}

function onTableauClick(colIndex, cardIndex) {
  const col = tableau[colIndex];

  if (selection) {
    if (tryMoveToTableau(colIndex)) {
      render();
      return;
    }
    if (
      cardIndex != null &&
      col[cardIndex]?.faceUp &&
      isValidSequence(col.slice(cardIndex).map((entry) => entry.card)) &&
      !(selection.type === "tableau" && selection.col === colIndex && selection.index === cardIndex)
    ) {
      selection = { type: "tableau", col: colIndex, index: cardIndex };
    } else {
      clearSelection();
    }
    render();
    return;
  }

  if (
    cardIndex != null &&
    col[cardIndex]?.faceUp &&
    isValidSequence(col.slice(cardIndex).map((entry) => entry.card))
  ) {
    selection = { type: "tableau", col: colIndex, index: cardIndex };
  }
  render();
}

/* --- Rendering ------------------------------------------------------------ */

function buildCardFace(card) {
  const face = el("div", "card-face");
  for (const cornerClass of ["card-corner card-corner-tl", "card-corner card-corner-br"]) {
    const corner = el("div", cornerClass);
    corner.append(el("span", "card-rank", card.rank), el("span", "card-suit-small", card.suit));
    face.append(corner);
  }
  const center = el("div", "card-suit-big", card.suit);
  face.insertBefore(center, face.lastChild);
  return face;
}

function makeCardEl(card, { faceUp, selected }) {
  const btn = el("button", "card" + (faceUp ? " is-face-up" : " is-face-down"));
  btn.type = "button";
  if (faceUp) {
    btn.classList.add(isRed(card.suit) ? "is-red" : "is-black");
    btn.append(buildCardFace(card));
  }
  if (selected) btn.classList.add("is-selected");
  return btn;
}

function renderPileStack(container, cards, { faceUp = true } = {}) {
  container.textContent = "";
  if (!cards.length) return;
  const top = cards[cards.length - 1];
  container.append(makeCardEl(top, { faceUp }));
}

function render() {
  if (!root) return;
  const dict = STRINGS[lang];

  // Stokk (bunke å trekke fra)
  stockEl.textContent = "";
  stockEl.classList.toggle("is-empty", stock.length === 0);
  if (stock.length) {
    stockEl.append(el("div", "card is-face-down"));
  } else if (waste.length) {
    stockEl.append(el("div", "card-recycle", "↺"));
  }

  // Kastebunke
  renderPileStack(wasteEl, waste, { faceUp: true });
  wasteEl.classList.toggle("is-selected", selection?.type === "waste");

  // Fundamenter
  for (const suit of SUITS) {
    const pileEl = foundationEls[suit];
    pileEl.textContent = "";
    const pile = foundations[suit];
    if (pile.length) {
      pileEl.append(makeCardEl(pile[pile.length - 1], { faceUp: true }));
    } else {
      pileEl.append(el("span", "foundation-placeholder", suit));
    }
  }

  // Tablå
  for (let col = 0; col < COLUMNS; col++) {
    const colEl = tableauEls[col];
    colEl.textContent = "";
    const entries = tableau[col];
    let offset = 0;
    entries.forEach((entry, index) => {
      const selected =
        selection?.type === "tableau" && selection.col === col && index >= selection.index;
      const cardEl = makeCardEl(entry.card, { faceUp: entry.faceUp, selected });
      cardEl.style.top = `${offset}px`;
      cardEl.dataset.cardIndex = String(index);
      colEl.append(cardEl);
      offset += entry.faceUp ? SOLITAIRE.faceUpOffset : SOLITAIRE.faceDownOffset;
    });
    const minHeight = SOLITAIRE.cardHeight + Math.max(0, offset - (entries.length ? SOLITAIRE.faceUpOffset : 0));
    colEl.style.minHeight = `${Math.max(SOLITAIRE.cardHeight, minHeight)}px`;
  }

  if (statusEl) {
    statusEl.textContent = won ? dict["solitaire.won"] : `${dict["solitaire.moves"]}: ${moves}`;
  }
  root.classList.toggle("is-won", won);
}

/* --- Oppbygging av UI ------------------------------------------------------- */

function buildChrome() {
  const dict = STRINGS[lang];

  const topRow = el("div", "solitaire-row-top");

  stockEl = el("div", "solitaire-pile solitaire-stock");
  stockEl.addEventListener("click", drawFromStock);
  wasteEl = el("div", "solitaire-pile solitaire-waste");
  wasteEl.addEventListener("click", onWasteClick);
  wasteEl.addEventListener("dblclick", () => {
    if (autoToFoundation("waste")) render();
  });

  const spacer = el("div", "solitaire-spacer");

  const foundationRow = el("div", "solitaire-foundations");
  for (const suit of SUITS) {
    const pileEl = el("div", "solitaire-pile solitaire-foundation" + (isRed(suit) ? " is-red" : " is-black"));
    pileEl.addEventListener("click", () => onFoundationClick(suit));
    foundationEls[suit] = pileEl;
    foundationRow.append(pileEl);
  }

  topRow.append(stockEl, wasteEl, spacer, foundationRow);

  const tableauRow = el("div", "solitaire-tableau");
  tableauEls = [];
  for (let col = 0; col < COLUMNS; col++) {
    const colEl = el("div", "solitaire-column");
    colEl.addEventListener("click", (event) => {
      const cardTarget = event.target.closest("[data-card-index]");
      const cardIndex = cardTarget ? Number(cardTarget.dataset.cardIndex) : null;
      onTableauClick(col, cardIndex);
    });
    colEl.addEventListener("dblclick", (event) => {
      const cardTarget = event.target.closest("[data-card-index]");
      const cardIndex = cardTarget ? Number(cardTarget.dataset.cardIndex) : null;
      if (cardIndex === tableau[col].length - 1 && autoToFoundation("tableau", col)) render();
    });
    tableauEls.push(colEl);
    tableauRow.append(colEl);
  }

  newGameBtn = el("button", "btn solitaire-new-game", dict["solitaire.newGame"]);
  newGameBtn.type = "button";
  newGameBtn.addEventListener("click", () => {
    deal();
    render();
  });

  root.append(newGameBtn, topRow, tableauRow);
}

/* --- Offentlig API ----------------------------------------------------------- */

export function init() {
  root = document.querySelector("#solitaire-body");
  statusEl = document.querySelector("#solitaire-status");
  if (!root) return;

  buildChrome();
  deal();
  render();
}

export function start() {
  /* Ingen server-data å hente — spillet er klart etter init(). */
}

export function setLanguage(next) {
  lang = next;
  const dict = STRINGS[lang];
  if (!root) return;
  if (newGameBtn) newGameBtn.textContent = dict["solitaire.newGame"];
  render();
}
