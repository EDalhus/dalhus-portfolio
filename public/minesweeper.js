/* ==========================================================================
   minesweeper.js — klassisk Minesveiper. Rent lokalt, ingen server-data.
   ========================================================================== */

import { MINESWEEPER, STRINGS } from "./config.js";

const NUMBER_COLORS = ["", "#0000ff", "#008000", "#ff0000", "#000080", "#800000", "#008080", "#000000", "#808080"];

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let lang = "no";
let winEl, root, headerEl, counterEl, timerEl, smileyEl, boardEl, flagModeBtn, statusEl;
let difficultyButtons = [];

let cols = 0;
let rows = 0;
let mineTotal = 0;
let preset = MINESWEEPER.defaultPreset;
let board = [];
let cellButtons = [];
let phase = "idle"; // idle | playing | won | lost
let flagCount = 0;
let revealedCount = 0;
let firstClickDone = false;
let flagMode = false;
let timerId = null;
let seconds = 0;

function index(x, y) {
  return y * cols + x;
}

function inBounds(x, y) {
  return x >= 0 && x < cols && y >= 0 && y < rows;
}

function neighbors(x, y) {
  const list = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny)) list.push({ x: nx, y: ny });
    }
  }
  return list;
}

/* --- Oppsett ------------------------------------------------------------- */

function createBoard() {
  board = Array.from({ length: cols * rows }, () => ({
    mine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
  }));
  revealedCount = 0;
  flagCount = 0;
  firstClickDone = false;
}

function placeMines(excludeX, excludeY) {
  const excludeIdx = index(excludeX, excludeY);
  let placed = 0;
  while (placed < mineTotal) {
    const idx = Math.floor(Math.random() * board.length);
    if (idx === excludeIdx || board[idx].mine) continue;
    board[idx].mine = true;
    placed += 1;
  }
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const cell = board[index(x, y)];
      if (cell.mine) continue;
      cell.adjacent = neighbors(x, y).filter(({ x: nx, y: ny }) => board[index(nx, ny)].mine).length;
    }
  }
}

/* --- Timer ----------------------------------------------------------------- */

function startTimer() {
  stopTimer();
  seconds = 0;
  updateTimerDisplay();
  timerId = setInterval(() => {
    seconds = Math.min(999, seconds + 1);
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function updateTimerDisplay() {
  if (timerEl) timerEl.textContent = String(seconds).padStart(3, "0");
}

function updateCounterDisplay() {
  if (!counterEl) return;
  const remaining = mineTotal - flagCount;
  const sign = remaining < 0 ? "-" : "";
  counterEl.textContent = sign + String(Math.abs(remaining)).padStart(remaining < 0 ? 2 : 3, "0");
}

/* --- Smiley ---------------------------------------------------------------- */

function setSmiley(face) {
  if (smileyEl) smileyEl.textContent = face;
}

function faceForPhase() {
  if (phase === "won") return "😎";
  if (phase === "lost") return "😵";
  return "🙂";
}

/* --- Rendering --------------------------------------------------------------- */

function renderCell(x, y) {
  const cell = board[index(x, y)];
  const btn = cellButtons[index(x, y)];
  if (!btn) return;

  btn.classList.toggle("is-revealed", cell.revealed);
  btn.classList.remove("is-exploded", "is-wrong-flag");
  btn.style.color = "";

  if (!cell.revealed) {
    btn.textContent = cell.flagged ? "🚩" : "";
    if (cell.flagged && !cell.mine && phase === "lost") {
      btn.classList.add("is-wrong-flag");
    }
    return;
  }

  if (cell.mine) {
    btn.textContent = "💣";
    if (cell.exploded) btn.classList.add("is-exploded");
    return;
  }

  btn.textContent = cell.adjacent > 0 ? String(cell.adjacent) : "";
  btn.style.color = NUMBER_COLORS[cell.adjacent] || "";
}

function renderAll() {
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) renderCell(x, y);
  }
  updateCounterDisplay();
  updateTimerDisplay();
  setSmiley(faceForPhase());
}

function updateStatus() {
  if (!statusEl) return;
  const word = lang === "no" ? "miner" : "mines";
  statusEl.textContent = `${cols}×${rows}, ${mineTotal} ${word}`;
}

/* --- Spillogikk ---------------------------------------------------------------- */

function reveal(x, y) {
  const cell = board[index(x, y)];
  if (cell.revealed || cell.flagged || phase !== "playing") return;

  if (!firstClickDone) {
    firstClickDone = true;
    placeMines(x, y);
    startTimer();
  }

  cell.revealed = true;
  revealedCount += 1;

  if (cell.mine) {
    cell.exploded = true;
    endGame(false);
    return;
  }

  if (cell.adjacent === 0) {
    for (const { x: nx, y: ny } of neighbors(x, y)) {
      const neighbor = board[index(nx, ny)];
      if (!neighbor.revealed && !neighbor.flagged) reveal(nx, ny);
    }
  } else {
    renderCell(x, y);
  }

  checkWin();
}

function chord(x, y) {
  const cell = board[index(x, y)];
  if (!cell.revealed || cell.adjacent === 0 || phase !== "playing") return;

  const around = neighbors(x, y);
  const flagged = around.filter(({ x: nx, y: ny }) => board[index(nx, ny)].flagged).length;
  if (flagged !== cell.adjacent) return;

  for (const { x: nx, y: ny } of around) reveal(nx, ny);
}

function toggleFlag(x, y) {
  const cell = board[index(x, y)];
  if (cell.revealed || phase !== "playing") return;
  cell.flagged = !cell.flagged;
  flagCount += cell.flagged ? 1 : -1;
  renderCell(x, y);
  updateCounterDisplay();
}

function checkWin() {
  if (revealedCount === cols * rows - mineTotal) endGame(true);
}

function endGame(won) {
  phase = won ? "won" : "lost";
  stopTimer();

  if (won) {
    for (let i = 0; i < board.length; i++) {
      if (board[i].mine) {
        board[i].flagged = true;
      }
    }
    flagCount = mineTotal;
  } else {
    for (let i = 0; i < board.length; i++) {
      if (board[i].mine) board[i].revealed = true;
    }
  }

  renderAll();
}

/* --- Bygging av brettet ------------------------------------------------------- */

function buildBoard() {
  boardEl.textContent = "";
  boardEl.style.gridTemplateColumns = `repeat(${cols}, ${MINESWEEPER.cell}px)`;
  cellButtons = new Array(cols * rows);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const btn = el("button", "mine-cell");
      btn.type = "button";
      btn.style.width = `${MINESWEEPER.cell}px`;
      btn.style.height = `${MINESWEEPER.cell}px`;

      btn.addEventListener("pointerdown", (event) => {
        if (event.button !== 0 && event.pointerType === "mouse") return;
        if (phase === "playing") setSmiley("😮");
      });

      btn.addEventListener("click", () => {
        if (flagMode) toggleFlag(x, y);
        else if (board[index(x, y)].revealed) chord(x, y);
        else reveal(x, y);
      });

      btn.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        toggleFlag(x, y);
      });

      cellButtons[index(x, y)] = btn;
      boardEl.append(btn);
    }
  }
}

function newGame() {
  const config = MINESWEEPER.presets[preset];
  cols = config.cols;
  rows = config.rows;
  mineTotal = config.mines;
  phase = "playing";
  stopTimer();
  seconds = 0;
  createBoard();
  buildBoard();
  renderAll();
  updateStatus();
  updateDifficultyButtons();
}

function updateDifficultyButtons() {
  for (const btn of difficultyButtons) {
    btn.classList.toggle("is-active", btn.dataset.preset === preset);
  }
}

/* --- Oppbygging av UI ------------------------------------------------------------ */

function buildChrome() {
  const dict = STRINGS[lang];

  const difficultyRow = el("div", "mine-difficulty");
  for (const key of ["beginner", "intermediate", "expert"]) {
    const btn = el("button", "btn mine-difficulty-btn", dict[`minesweeper.difficulty.${key}`]);
    btn.type = "button";
    btn.dataset.preset = key;
    btn.addEventListener("click", () => {
      preset = key;
      newGame();
    });
    difficultyButtons.push(btn);
    difficultyRow.append(btn);
  }

  flagModeBtn = el("button", "btn mine-flag-mode", `🚩 ${dict["minesweeper.flagMode"]}`);
  flagModeBtn.type = "button";
  flagModeBtn.setAttribute("aria-pressed", "false");
  flagModeBtn.addEventListener("click", () => {
    flagMode = !flagMode;
    flagModeBtn.classList.toggle("is-active", flagMode);
    flagModeBtn.setAttribute("aria-pressed", String(flagMode));
  });
  difficultyRow.append(flagModeBtn);

  headerEl = el("div", "mine-header field-sunken");
  counterEl = el("div", "mine-lcd mine-counter", "000");
  smileyEl = el("button", "mine-smiley", "🙂");
  smileyEl.type = "button";
  smileyEl.setAttribute("aria-label", dict["minesweeper.newGame"]);
  smileyEl.addEventListener("click", newGame);
  timerEl = el("div", "mine-lcd mine-timer", "000");
  headerEl.append(counterEl, smileyEl, timerEl);

  boardEl = el("div", "mine-board");

  root.append(difficultyRow, headerEl, boardEl);
}

/* --- Offentlig API ----------------------------------------------------------------- */

export function init() {
  winEl = document.querySelector('.window[data-window="minesweeper"]');
  root = document.querySelector("#minesweeper-body");
  statusEl = document.querySelector("#minesweeper-status");
  if (!winEl || !root) return;

  buildChrome();
  newGame();

  document.addEventListener("pointerup", () => {
    if (phase === "playing" || phase === "idle") setSmiley(faceForPhase());
  });
}

export function start() {
  /* Ingen server-data å hente — spillet er klart etter init(). */
}

export function setLanguage(next) {
  lang = next;
  const dict = STRINGS[lang];
  if (!root) return;

  for (const btn of difficultyButtons) {
    btn.textContent = dict[`minesweeper.difficulty.${btn.dataset.preset}`];
  }
  if (flagModeBtn) flagModeBtn.textContent = `🚩 ${dict["minesweeper.flagMode"]}`;
  if (smileyEl) smileyEl.setAttribute("aria-label", dict["minesweeper.newGame"]);
  updateStatus();
}
