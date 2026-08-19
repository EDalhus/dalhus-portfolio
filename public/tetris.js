/* ==========================================================================
   tetris.js — TETRIS for Windows: spillmotor, tegning og highscore-liste.
   Poengsummer sendes til /api/leaderboard (src/leaderboard.js), som lagrer
   dem i Workers KV og returnerer topplisten.
   ========================================================================== */

import { TETRIS, STRINGS } from "./config.js";

const COLS = TETRIS.cols;
const ROWS = TETRIS.rows;
const CELL = TETRIS.cell;
const NEXT_SIZE = 88;
const NEXT_CELL = 18;
const NAME_KEY = "dalhus.tetris.name";
const LINE_SCORES = [0, 40, 100, 300, 1200];

const PIECES = {
  I: { color: "#3fd6d6", matrix: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
  O: { color: "#dbd23f", matrix: [[1, 1], [1, 1]] },
  T: { color: "#a24fd6", matrix: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
  S: { color: "#3fd651", matrix: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
  Z: { color: "#d63f3f", matrix: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
  J: { color: "#3f5fd6", matrix: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
  L: { color: "#d68a3f", matrix: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
};
const PIECE_TYPES = Object.keys(PIECES);

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

let lang = "no";
let dict = STRINGS[lang];

/* --- DOM-referanser (satt i init) ------------------------------------------ */
let winEl, statusEl;
let scoresPanelEl, playPanelEl;
let boardCanvas, boardCtx, nextCanvas, nextCtx;
let scoreLabelEl, levelLabelEl, linesLabelEl, nextLabelEl;
let scoreValueEl, levelValueEl, linesValueEl;
let overlayEl;
let nameInput;
let activeSubtab = "scores";

/* --- Spilltilstand ----------------------------------------------------------- */
let board = createBoard();
let bag = [];
let nextType = null;
let piece = null;
let score = 0;
let level = 0;
let lines = 0;
let dropAccum = 0;
let lastTime = 0;
let rafId = null;
let phase = "idle"; // idle | playing | paused | gameover

let leaderboard = [];
let leaderboardState = "idle"; // idle | loading | loaded | error
let lastRank = null;
let lastSubmitFailed = false;
let started = false;

/* --- Brett / brikker ---------------------------------------------------------- */

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function rotateMatrix(matrix) {
  const n = matrix.length;
  const result = Array.from({ length: n }, () => Array(n).fill(0));
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) result[c][n - 1 - r] = matrix[r][c];
  }
  return result;
}

function refillBag() {
  const next = [...PIECE_TYPES];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  bag.push(...next);
}

function takeFromBag() {
  if (bag.length === 0) refillBag();
  return bag.shift();
}

function spawnPiece(type) {
  const def = PIECES[type];
  const matrix = def.matrix.map((row) => row.slice());
  const x = Math.floor((COLS - matrix[0].length) / 2);
  return { type, matrix, color: def.color, x, y: -2 };
}

function collides(matrix, x, y, testBoard = board) {
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (!matrix[r][c]) continue;
      const bx = x + c;
      const by = y + r;
      if (bx < 0 || bx >= COLS || by >= ROWS) return true;
      if (by >= 0 && testBoard[by][bx]) return true;
    }
  }
  return false;
}

function tryMove(dx, dy) {
  const nx = piece.x + dx;
  const ny = piece.y + dy;
  if (collides(piece.matrix, nx, ny)) return false;
  piece.x = nx;
  piece.y = ny;
  return true;
}

function tryRotate() {
  const rotated = rotateMatrix(piece.matrix);
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, piece.x + kick, piece.y)) {
      piece.matrix = rotated;
      piece.x += kick;
      return true;
    }
  }
  return false;
}

function ghostY() {
  let y = piece.y;
  while (!collides(piece.matrix, piece.x, y + 1)) y += 1;
  return y;
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((cell) => cell)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      r += 1;
    }
  }
  return cleared;
}

function applyScore(cleared) {
  if (cleared <= 0) return;
  score += LINE_SCORES[cleared] * (level + 1);
  lines += cleared;
  level = Math.floor(lines / 10);
}

function spawnNext() {
  const type = nextType ?? takeFromBag();
  nextType = takeFromBag();
  piece = spawnPiece(type);
  if (collides(piece.matrix, piece.x, piece.y)) triggerGameOver();
}

function lockPiece() {
  for (let r = 0; r < piece.matrix.length; r++) {
    for (let c = 0; c < piece.matrix[r].length; c++) {
      if (!piece.matrix[r][c]) continue;
      const bx = piece.x + c;
      const by = piece.y + r;
      if (by < 0) {
        triggerGameOver();
        return;
      }
      board[by][bx] = piece.color;
    }
  }
  applyScore(clearLines());
  spawnNext();
}

function softDrop(manual = false) {
  if (tryMove(0, 1)) {
    if (manual) score += 1;
    return true;
  }
  lockPiece();
  return false;
}

function hardDrop() {
  let distance = 0;
  while (tryMove(0, 1)) distance += 1;
  score += distance * 2;
  lockPiece();
}

function dropInterval() {
  return Math.max(120, 800 - level * 60);
}

/* --- Spilløkke ----------------------------------------------------------------- */

function isPlayVisible() {
  return Boolean(winEl) && !winEl.hidden && activeSubtab === "play";
}

function loop(time) {
  if (phase !== "playing") {
    rafId = null;
    return;
  }
  if (!isPlayVisible()) {
    rafId = null;
    setPhase("paused");
    return;
  }
  const delta = time - lastTime;
  lastTime = time;
  dropAccum += delta;
  if (dropAccum >= dropInterval()) {
    dropAccum = 0;
    softDrop();
  }
  render();
  updateStats();
  updateStatus();
  rafId = requestAnimationFrame(loop);
}

function cancelLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function startGame() {
  board = createBoard();
  bag = [];
  nextType = takeFromBag();
  score = 0;
  level = 0;
  lines = 0;
  dropAccum = 0;
  lastRank = null;
  lastSubmitFailed = false;
  spawnNext();
  updateStats();
  setPhase("playing");
  lastTime = performance.now();
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function togglePause() {
  if (phase === "playing") setPhase("paused");
  else if (phase === "paused") resumeGame();
}

function resumeGame() {
  lastTime = performance.now();
  setPhase("playing");
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function resetToIdle() {
  setPhase("idle");
}

async function triggerGameOver() {
  cancelLoop();
  setPhase("gameover");
  await submitScore();
  renderOverlay();
}

/* --- Tegning --------------------------------------------------------------------- */

function setupCanvas(canvas, widthCss, heightCss) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = widthCss * dpr;
  canvas.height = heightCss * dpr;
  canvas.style.width = `${widthCss}px`;
  canvas.style.height = `${heightCss}px`;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  return ctx;
}

function paintCell(ctx, px, py, size, color) {
  ctx.fillStyle = color;
  ctx.fillRect(px, py, size, size);
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.fillRect(px, py, size, 2);
  ctx.fillRect(px, py, 2, size);
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(px, py + size - 2, size, 2);
  ctx.fillRect(px + size - 2, py, 2, size);
}

function paintPiece(ctx, target, y, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let r = 0; r < target.matrix.length; r++) {
    for (let c = 0; c < target.matrix[r].length; c++) {
      if (!target.matrix[r][c]) continue;
      const by = y + r;
      if (by < 0) continue;
      paintCell(ctx, (target.x + c) * CELL, by * CELL, CELL, color);
    }
  }
  ctx.restore();
}

function render() {
  if (!boardCtx) return;
  boardCtx.fillStyle = "#000000";
  boardCtx.fillRect(0, 0, COLS * CELL, ROWS * CELL);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (board[r][c]) paintCell(boardCtx, c * CELL, r * CELL, CELL, board[r][c]);
    }
  }

  if (piece && (phase === "playing" || phase === "paused")) {
    paintPiece(boardCtx, piece, ghostY(), piece.color, 0.25);
    paintPiece(boardCtx, piece, piece.y, piece.color, 1);
  }

  renderNext();
}

function renderNext() {
  if (!nextCtx) return;
  nextCtx.fillStyle = "#000000";
  nextCtx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE);
  if (!nextType) return;

  const def = PIECES[nextType];
  const size = def.matrix.length;
  const offsetX = (NEXT_SIZE - size * NEXT_CELL) / 2;
  const offsetY = (NEXT_SIZE - size * NEXT_CELL) / 2;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!def.matrix[r][c]) continue;
      paintCell(nextCtx, offsetX + c * NEXT_CELL, offsetY + r * NEXT_CELL, NEXT_CELL, def.color);
    }
  }
}

/* --- Statistikk / statuslinje ----------------------------------------------------- */

function updateStats() {
  if (scoreValueEl) scoreValueEl.textContent = String(score);
  if (levelValueEl) levelValueEl.textContent = String(level);
  if (linesValueEl) linesValueEl.textContent = String(lines);
}

function updateStatus() {
  if (!statusEl) return;
  if (phase === "playing") statusEl.textContent = `${dict["tetris.score"]}: ${score}`;
  else if (phase === "paused") statusEl.textContent = dict["tetris.paused"];
  else if (phase === "gameover") statusEl.textContent = dict["tetris.gameOver"];
  else statusEl.textContent = "";
}

function setPhase(next) {
  phase = next;
  renderOverlay();
  updateStatus();
}

/* --- Navn (localStorage) ----------------------------------------------------------- */

function loadStoredName() {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
}

function storeName(name) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    /* ignorer */
  }
}

/* --- Overlay (navneskjema / pause / game over) -------------------------------------- */

function buildNameForm() {
  const box = el("div", "tetris-overlay-box");
  box.append(el("p", "tetris-overlay-title", dict["tetris.title"]));

  const label = el("label", "tetris-name-label", dict["tetris.name.label"]);
  label.htmlFor = "tetris-name-input";

  nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "tetris-name-input";
  nameInput.className = "text-input";
  nameInput.maxLength = 12;
  nameInput.autocomplete = "off";
  nameInput.placeholder = dict["tetris.name.placeholder"];
  nameInput.value = loadStoredName();
  nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") handleStartClick();
  });

  const startBtn = el("button", "btn", dict["tetris.start"]);
  startBtn.type = "button";
  startBtn.addEventListener("click", handleStartClick);

  const hint = el("p", "tetris-controls-hint", dict["tetris.controls.hint"]);

  box.append(label, nameInput, startBtn, hint);
  return box;
}

function handleStartClick() {
  const name = nameInput.value.trim();
  if (!name) {
    nameInput.focus();
    return;
  }
  storeName(name);
  startGame();
}

function renderOverlay() {
  if (!overlayEl) return;
  overlayEl.textContent = "";
  overlayEl.classList.toggle("is-visible", phase !== "playing");

  if (phase === "idle") {
    overlayEl.append(buildNameForm());
    return;
  }

  if (phase === "paused") {
    const box = el("div", "tetris-overlay-box");
    box.append(el("p", "tetris-overlay-title", dict["tetris.paused"]));
    const resumeBtn = el("button", "btn", dict["tetris.resume"]);
    resumeBtn.type = "button";
    resumeBtn.addEventListener("click", resumeGame);
    box.append(resumeBtn);
    overlayEl.append(box);
    return;
  }

  if (phase === "gameover") {
    const box = el("div", "tetris-overlay-box");
    box.append(el("p", "tetris-overlay-title", dict["tetris.gameOver"]));
    box.append(el("p", "tetris-overlay-score", `${dict["tetris.yourScore"]}: ${score}`));
    if (lastRank && lastRank <= 3) {
      box.append(el("p", "tetris-overlay-rank", dict["tetris.newHighScore"]));
    }
    if (lastSubmitFailed) {
      box.append(el("p", "tetris-overlay-note", dict["tetris.submitError"]));
    }
    const againBtn = el("button", "btn", dict["tetris.playAgain"]);
    againBtn.type = "button";
    againBtn.addEventListener("click", resetToIdle);
    box.append(againBtn);
    overlayEl.append(box);
  }
}

/* --- Highscore-liste ------------------------------------------------------------------ */

async function loadLeaderboard() {
  leaderboardState = "loading";
  renderScores();
  try {
    const res = await fetch(TETRIS.endpoint, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    leaderboard = body.entries || [];
    leaderboardState = "loaded";
  } catch (error) {
    leaderboardState = "error";
    console.warn("[tetris] kunne ikke hente poengliste:", error.message);
  }
  renderScores();
}

async function submitScore() {
  const name = loadStoredName() || "???";
  try {
    const res = await fetch(TETRIS.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, score, level, lines }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    leaderboard = body.entries || [];
    leaderboardState = "loaded";
    lastRank = body.rank ?? null;
    lastSubmitFailed = false;
  } catch (error) {
    lastSubmitFailed = true;
    console.warn("[tetris] kunne ikke lagre poengsum:", error.message);
  }
  renderScores();
}

function renderScores() {
  if (!scoresPanelEl) return;
  scoresPanelEl.textContent = "";

  if (leaderboardState === "loading") {
    scoresPanelEl.append(el("p", "gallery-message", dict["tetris.highScores.loading"]));
    return;
  }

  if (leaderboardState === "error") {
    scoresPanelEl.append(el("p", "gallery-message", dict["tetris.highScores.error"]));
    const wrap = el("p", "gallery-actions");
    const retryBtn = el("button", "btn", dict["tetris.highScores.retry"]);
    retryBtn.type = "button";
    retryBtn.addEventListener("click", loadLeaderboard);
    wrap.append(retryBtn);
    scoresPanelEl.append(wrap);
    return;
  }

  if (!leaderboard.length) {
    scoresPanelEl.append(el("p", "gallery-message", dict["tetris.highScores.empty"]));
    return;
  }

  const table = document.createElement("table");
  table.className = "score-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const key of ["rank", "name", "score", "level"]) {
    headRow.append(el("th", null, dict[`tetris.highScores.${key}`]));
  }
  thead.append(headRow);

  const tbody = document.createElement("tbody");
  leaderboard.forEach((entry, index) => {
    const row = document.createElement("tr");
    if (index + 1 === lastRank) row.classList.add("is-you");
    row.append(
      el("td", "score-table-rank", String(index + 1)),
      el("td", "score-table-name", entry.name),
      el("td", "score-table-score", String(entry.score)),
      el("td", "score-table-level", String(entry.level ?? 0)),
    );
    tbody.append(row);
  });

  table.append(thead, tbody);
  scoresPanelEl.append(table);
}

/* --- Faner (Poengliste / Spill) --------------------------------------------------------- */

function switchSubtab(name) {
  activeSubtab = name;
  scoresPanelEl.hidden = name !== "scores";
  playPanelEl.hidden = name !== "play";

  for (const tab of winEl.querySelectorAll("[data-tetris-tab]")) {
    const isActive = tab.dataset.tetrisTab === name;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  }

  if (name === "play" && phase === "playing" && !rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(loop);
  }
}

/* --- Tastatur / berøringskontroller ----------------------------------------------------- */

function isActiveContext() {
  return Boolean(winEl) && !winEl.hidden && winEl.classList.contains("is-focused") && activeSubtab === "play";
}

function handleKeydown(event) {
  if (!isActiveContext() || phase === "idle" || phase === "gameover") return;

  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    togglePause();
    return;
  }

  if (phase === "paused") {
    if (event.key === " ") {
      event.preventDefault();
      resumeGame();
    }
    return;
  }

  let handled = true;
  switch (event.key) {
    case "ArrowLeft":
      tryMove(-1, 0);
      break;
    case "ArrowRight":
      tryMove(1, 0);
      break;
    case "ArrowDown":
      softDrop(true);
      break;
    case "ArrowUp":
      tryRotate();
      break;
    case " ":
      hardDrop();
      break;
    default:
      handled = false;
  }

  if (handled) {
    event.preventDefault();
    render();
    updateStats();
  }
}

function buildTouchControls() {
  const row = el("div", "tetris-controls-mobile");
  const actions = [
    ["left", "◀", () => tryMove(-1, 0)],
    ["rotate", "↻", () => tryRotate()],
    ["right", "▶", () => tryMove(1, 0)],
    ["down", "▼", () => softDrop(true)],
    ["drop", "▼▼", () => hardDrop()],
  ];

  for (const [name, label, action] of actions) {
    const btn = el("button", "btn tetris-touch-btn", label);
    btn.type = "button";
    btn.dataset.tetrisMove = name;
    btn.addEventListener("click", () => {
      if (phase !== "playing") return;
      action();
      render();
      updateStats();
    });
    row.append(btn);
  }
  return row;
}

/* --- Oppbygging av Spill-panelet --------------------------------------------------------- */

function buildStat(key) {
  const box = el("div", "field-sunken tetris-stat");
  const label = el("p", "tetris-stat-label", dict[`tetris.${key}`]);
  const value = el("p", "tetris-stat-value", "0");
  box.append(label, value);
  return { box, label, value };
}

function buildPlayPanel() {
  const panel = el("div", "tetris-play");
  panel.hidden = true;

  const side = el("div", "tetris-side");

  const scoreStat = buildStat("score");
  const levelStat = buildStat("level");
  const linesStat = buildStat("lines");
  scoreLabelEl = scoreStat.label;
  levelLabelEl = levelStat.label;
  linesLabelEl = linesStat.label;
  scoreValueEl = scoreStat.value;
  levelValueEl = levelStat.value;
  linesValueEl = linesStat.value;

  const nextBox = el("div", "field-sunken tetris-next");
  nextLabelEl = el("p", "section-label", dict["tetris.next"]);
  nextCanvas = document.createElement("canvas");
  nextCanvas.className = "tetris-next-canvas";
  nextBox.append(nextLabelEl, nextCanvas);

  side.append(scoreStat.box, levelStat.box, linesStat.box, nextBox);

  const boardWrap = el("div", "tetris-board-wrap");
  boardCanvas = document.createElement("canvas");
  boardCanvas.className = "tetris-board";
  overlayEl = el("div", "tetris-overlay");
  boardWrap.append(boardCanvas, overlayEl);

  panel.append(side, boardWrap, buildTouchControls());
  return panel;
}

/* --- Offentlig API ------------------------------------------------------------------------ */

export function init() {
  winEl = document.querySelector('.window[data-window="tetris"]');
  statusEl = document.querySelector("#tetris-status");
  const root = document.querySelector("#tetris-body");
  if (!winEl || !root) return;

  scoresPanelEl = el("div", "tetris-scores");
  playPanelEl = buildPlayPanel();
  root.append(scoresPanelEl, playPanelEl);

  boardCtx = setupCanvas(boardCanvas, COLS * CELL, ROWS * CELL);
  nextCtx = setupCanvas(nextCanvas, NEXT_SIZE, NEXT_SIZE);

  for (const tab of winEl.querySelectorAll("[data-tetris-tab]")) {
    tab.addEventListener("click", () => switchSubtab(tab.dataset.tetrisTab));
  }

  document.addEventListener("keydown", handleKeydown);

  switchSubtab("scores");
  renderOverlay();
  renderScores();
  render();
}

export function start() {
  if (started) return;
  started = true;
  loadLeaderboard();
}

export function setLanguage(next) {
  lang = next;
  dict = STRINGS[lang];

  if (scoreLabelEl) scoreLabelEl.textContent = dict["tetris.score"];
  if (levelLabelEl) levelLabelEl.textContent = dict["tetris.level"];
  if (linesLabelEl) linesLabelEl.textContent = dict["tetris.lines"];
  if (nextLabelEl) nextLabelEl.textContent = dict["tetris.next"];

  renderOverlay();
  renderScores();
  updateStatus();
}
