/* ==========================================================================
   pinball.js — enkelt flipperspill med ekte 2D-fysikk (tyngdekraft,
   veggkollisjon, bumpere, flippere med fart basert på svingehastighet).

   Dette er en forenklet v1 med et originaltegnet bane-oppsett — ingen
   assets fra det klassiske "3D Pinball for Windows – Space Cadet" er brukt.
   ========================================================================== */

import { PINBALL, STRINGS } from "./config.js";

const TABLE_W = PINBALL.width;
const TABLE_H = PINBALL.height;
const BALL_R = PINBALL.ballRadius;

const GRAVITY = 620; // px/s²
const RESTITUTION = 0.55;
const BUMPER_KICK = 260;
const BUMPER_SCORE = 100;
const FLIPPER_KICK_SCALE = 0.55;
const FLIPPER_LENGTH = 70;
const FLIPPER_THICKNESS = 8;
const FLIPPER_UP_SPEED = 14; // rad/s mot aktiv vinkel
const FLIPPER_DOWN_SPEED = 9; // rad/s tilbake mot hvilevinkel
const MAX_SPEED = 900;
const LAUNCH_MIN = 380;
const LAUNCH_RANGE = 560;
const LAUNCH_CHARGE_TIME = 0.9; // sekunder til fullt ladet
const SUBSTEP = 1 / 240;

const deg = (d) => (d * Math.PI) / 180;

/* --- Banelayout ------------------------------------------------------------- */

const LANE_X = TABLE_W - 40;

const WALLS = [
  // Ytre vegg: fra venstre flipper-området, opp og rundt — stopper klart
  // til venstre for skyte-banen, med et ekte åpent gap øverst (ikke bare
  // to vegger som møtes i ett punkt) slik at ballen faktisk kan passere
  // fra skyte-banen og inn i hovedfeltet.
  [30, 560, 20, 480],
  [20, 480, 20, 100],
  [20, 100, 40, 40],
  [40, 40, 90, 15],
  [90, 15, 160, 5],
  [160, 5, 230, 5],
  [230, 5, 300, 15],
  [300, 15, 330, 35],
  // Skillevegg mot skyte-banen — dobbel funksjon: hovedfeltets høyre vegg
  // OG skyte-banens indre vegg, helt ned til gulvet der ballen venter.
  // Stopper godt under toppen (åpent gap over til hovedfeltet).
  [LANE_X, 150, LANE_X, 610],
  // Ned mot venstre og høyre flipper-pivot (åpent gap mellom dem = "drain")
  [30, 560, 60, 600],
  [60, 600, 128, 615],
  [LANE_X, 560, LANE_X - 60, 600],
  [LANE_X - 60, 600, LANE_X - 128, 615],
  // Skyte-banens ytre vegg og gulv
  [LANE_X + 10, 120, TABLE_W - 6, 150],
  [TABLE_W - 6, 150, TABLE_W - 6, 610],
  [TABLE_W - 6, 610, LANE_X, 610],
];

const BUMPERS = [
  { x: 140, y: 190, radius: 22 },
  { x: 240, y: 150, radius: 22 },
  { x: 190, y: 260, radius: 22 },
];

// Vinkelkonvensjon: 0° = høyre, 90° = ned (canvas har Y nedover), -90° = opp.
// I hvile peker flipperne utover/nedover; aktivert svinger de opp/innover.
function makeFlipper(side) {
  const isLeft = side === "left";
  return {
    side,
    pivotX: isLeft ? 128 : LANE_X - 128,
    pivotY: 600,
    length: FLIPPER_LENGTH,
    restAngle: isLeft ? deg(160) : deg(20),
    activeAngle: isLeft ? deg(-15) : deg(195),
    angle: isLeft ? deg(160) : deg(20),
    angularVelocity: 0,
    active: false,
  };
}

/* --- Tilstand ----------------------------------------------------------------- */

let lang = "no";
let winEl, statusEl;
let canvas, ctx;
let overlayEl;
let scoreValueEl, ballsValueEl;

let ball = null;
let flippers = { left: makeFlipper("left"), right: makeFlipper("right") };
let launchCharge = 0;
let charging = false;

let score = 0;
let ballsRemaining = PINBALL.startBalls;
let phase = "idle"; // idle | playing | paused | gameover
let rafId = null;
let lastTime = 0;
let accumulator = 0;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/* --- Geometri-hjelpere ---------------------------------------------------------- */

function closestPointOnSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  let t = lengthSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

function resetBall() {
  ball = { x: LANE_X + 18, y: 600, vx: 0, vy: 0, inPlay: true };
}

/* --- Fysikk ------------------------------------------------------------------------ */

function resolveSegment(x1, y1, x2, y2) {
  const closest = closestPointOnSegment(ball.x, ball.y, x1, y1, x2, y2);
  const dx = ball.x - closest.x;
  const dy = ball.y - closest.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0 || dist >= BALL_R) return;

  const nx = dx / dist;
  const ny = dy / dist;
  ball.x += nx * (BALL_R - dist);
  ball.y += ny * (BALL_R - dist);

  const vDotN = ball.vx * nx + ball.vy * ny;
  if (vDotN < 0) {
    ball.vx -= (1 + RESTITUTION) * vDotN * nx;
    ball.vy -= (1 + RESTITUTION) * vDotN * ny;
  }
}

function resolveBumper(bumper, now) {
  const dx = ball.x - bumper.x;
  const dy = ball.y - bumper.y;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL_R + bumper.radius;
  if (dist === 0 || dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;
  ball.x += nx * (minDist - dist);
  ball.y += ny * (minDist - dist);

  const vDotN = ball.vx * nx + ball.vy * ny;
  ball.vx -= (1 + RESTITUTION) * vDotN * nx;
  ball.vy -= (1 + RESTITUTION) * vDotN * ny;
  ball.vx += nx * BUMPER_KICK;
  ball.vy += ny * BUMPER_KICK;

  bumper.flashUntil = now + 150;
  score += BUMPER_SCORE;
  updateScoreDisplay();
}

function resolveFlipper(flipper, dt) {
  const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
  const tipY = flipper.pivotY + Math.sin(flipper.angle) * Math.abs(flipper.length);
  const closest = closestPointOnSegment(ball.x, ball.y, flipper.pivotX, flipper.pivotY, tipX, tipY);

  const dx = ball.x - closest.x;
  const dy = ball.y - closest.y;
  const dist = Math.hypot(dx, dy);
  const minDist = BALL_R + FLIPPER_THICKNESS;
  if (dist === 0 || dist >= minDist) return;

  const nx = dx / dist;
  const ny = dy / dist;
  ball.x += nx * (minDist - dist);
  ball.y += ny * (minDist - dist);

  const rx = closest.x - flipper.pivotX;
  const ry = closest.y - flipper.pivotY;
  const tangentX = -ry;
  const tangentY = rx;

  const vDotN = ball.vx * nx + ball.vy * ny;
  if (vDotN < 0) {
    ball.vx -= (1 + RESTITUTION) * vDotN * nx;
    ball.vy -= (1 + RESTITUTION) * vDotN * ny;
  }
  ball.vx += tangentX * flipper.angularVelocity * FLIPPER_KICK_SCALE;
  ball.vy += tangentY * flipper.angularVelocity * FLIPPER_KICK_SCALE;
}

function clampSpeed() {
  const speed = Math.hypot(ball.vx, ball.vy);
  if (speed > MAX_SPEED) {
    const scale = MAX_SPEED / speed;
    ball.vx *= scale;
    ball.vy *= scale;
  }
}

function updateFlipperAngle(flipper, dt) {
  const target = flipper.active ? flipper.activeAngle : flipper.restAngle;
  const speed = flipper.active ? FLIPPER_UP_SPEED : FLIPPER_DOWN_SPEED;
  const diff = target - flipper.angle;
  if (diff === 0) {
    flipper.angularVelocity = 0;
    return;
  }
  const maxStep = speed * dt;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
  flipper.angle += step;
  flipper.angularVelocity = step / dt;
}

function step(dt) {
  updateFlipperAngle(flippers.left, dt);
  updateFlipperAngle(flippers.right, dt);

  if (charging) {
    launchCharge = Math.min(1, launchCharge + dt / LAUNCH_CHARGE_TIME);
  }

  if (!ball) return;

  if (ball.inPlay) {
    ball.vy += GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    for (const [x1, y1, x2, y2] of WALLS) resolveSegment(x1, y1, x2, y2);
    const now = performance.now();
    for (const bumper of BUMPERS) resolveBumper(bumper, now);
    resolveFlipper(flippers.left, dt);
    resolveFlipper(flippers.right, dt);
    clampSpeed();

    if (ball.y - BALL_R > TABLE_H) loseBall();
  }
}

/* --- Spilltilstand ------------------------------------------------------------------- */

function loseBall() {
  ballsRemaining -= 1;
  updateBallsDisplay();
  if (ballsRemaining <= 0) {
    triggerGameOver();
  } else {
    resetBall();
  }
}

function launchBall() {
  if (!ball || !ball.inPlay) return;
  ball.vy = -(LAUNCH_MIN + launchCharge * LAUNCH_RANGE);
  ball.vx = -30;
  launchCharge = 0;
}

function startGame() {
  score = 0;
  ballsRemaining = PINBALL.startBalls;
  launchCharge = 0;
  charging = false;
  flippers = { left: makeFlipper("left"), right: makeFlipper("right") };
  resetBall();
  updateScoreDisplay();
  updateBallsDisplay();
  setPhase("playing");
  lastTime = performance.now();
  accumulator = 0;
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function togglePause() {
  if (phase === "playing") setPhase("paused");
  else if (phase === "paused") resumeGame();
}

function resumeGame() {
  lastTime = performance.now();
  accumulator = 0;
  setPhase("playing");
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function resetToIdle() {
  setPhase("idle");
}

function triggerGameOver() {
  cancelLoop();
  setPhase("gameover");
}

function cancelLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function isPlayVisible() {
  return Boolean(winEl) && !winEl.hidden;
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

  const delta = Math.min(0.1, (time - lastTime) / 1000);
  lastTime = time;
  accumulator += delta;

  while (accumulator >= SUBSTEP) {
    step(SUBSTEP);
    accumulator -= SUBSTEP;
  }

  render();
  updateStatus();
  rafId = requestAnimationFrame(loop);
}

/* --- Tegning ------------------------------------------------------------------------- */

function drawFlipper(flipper) {
  const tipX = flipper.pivotX + Math.cos(flipper.angle) * flipper.length;
  const tipY = flipper.pivotY + Math.sin(flipper.angle) * Math.abs(flipper.length);
  ctx.strokeStyle = "#e0d030";
  ctx.lineWidth = FLIPPER_THICKNESS * 2;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(flipper.pivotX, flipper.pivotY);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();
}

function render() {
  if (!ctx) return;
  ctx.fillStyle = "#0a0a18";
  ctx.fillRect(0, 0, TABLE_W, TABLE_H);

  ctx.strokeStyle = "#8f8fa8";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const [x1, y1, x2, y2] of WALLS) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  const now = performance.now();
  for (const bumper of BUMPERS) {
    const flashing = bumper.flashUntil && bumper.flashUntil > now;
    ctx.fillStyle = flashing ? "#ffe066" : "#d6433f";
    ctx.beginPath();
    ctx.arc(bumper.x, bumper.y, bumper.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  drawFlipper(flippers.left);
  drawFlipper(flippers.right);

  if (ball) {
    ctx.fillStyle = "#e8e8f0";
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.arc(ball.x - BALL_R * 0.3, ball.y - BALL_R * 0.3, BALL_R * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  if (charging) {
    ctx.fillStyle = "#3fd651";
    const meterHeight = 120 * launchCharge;
    ctx.fillRect(TABLE_W - 14, TABLE_H - 40 - meterHeight, 8, meterHeight);
  }
}

/* --- Statistikk / status --------------------------------------------------------------- */

function updateScoreDisplay() {
  if (scoreValueEl) scoreValueEl.textContent = String(score);
}

function updateBallsDisplay() {
  if (ballsValueEl) ballsValueEl.textContent = String(Math.max(0, ballsRemaining));
}

function updateStatus() {
  const dict = STRINGS[lang];
  if (!statusEl) return;
  if (phase === "playing") statusEl.textContent = `${dict["pinball.score"]}: ${score}`;
  else if (phase === "paused") statusEl.textContent = dict["pinball.paused"];
  else if (phase === "gameover") statusEl.textContent = dict["pinball.gameOver"];
  else statusEl.textContent = "";
}

function setPhase(next) {
  phase = next;
  renderOverlay();
  updateStatus();
}

/* --- Overlay ----------------------------------------------------------------------------- */

function renderOverlay() {
  if (!overlayEl) return;
  overlayEl.textContent = "";
  overlayEl.classList.toggle("is-visible", phase !== "playing");

  if (phase === "idle") {
    const box = el("div", "pinball-overlay-box");
    box.append(el("p", "pinball-overlay-title", STRINGS[lang]["pinball.title"]));
    const startBtn = el("button", "btn", STRINGS[lang]["pinball.start"]);
    startBtn.type = "button";
    startBtn.addEventListener("click", startGame);
    box.append(startBtn, el("p", "pinball-controls-hint", STRINGS[lang]["pinball.controls.hint"]));
    overlayEl.append(box);
    return;
  }

  if (phase === "paused") {
    const box = el("div", "pinball-overlay-box");
    box.append(el("p", "pinball-overlay-title", STRINGS[lang]["pinball.paused"]));
    const resumeBtn = el("button", "btn", STRINGS[lang]["pinball.resume"]);
    resumeBtn.type = "button";
    resumeBtn.addEventListener("click", resumeGame);
    box.append(resumeBtn);
    overlayEl.append(box);
    return;
  }

  if (phase === "gameover") {
    const box = el("div", "pinball-overlay-box");
    box.append(el("p", "pinball-overlay-title", STRINGS[lang]["pinball.gameOver"]));
    box.append(el("p", "pinball-overlay-score", `${STRINGS[lang]["pinball.yourScore"]}: ${score}`));
    const againBtn = el("button", "btn", STRINGS[lang]["pinball.playAgain"]);
    againBtn.type = "button";
    againBtn.addEventListener("click", resetToIdle);
    box.append(againBtn);
    overlayEl.append(box);
  }
}

/* --- Tastatur ------------------------------------------------------------------------------ */

function isActiveContext() {
  return Boolean(winEl) && !winEl.hidden && winEl.classList.contains("is-focused");
}

function handleKeydown(event) {
  if (!isActiveContext()) return;

  if (event.key === "p" || event.key === "P") {
    event.preventDefault();
    if (phase === "playing" || phase === "paused") togglePause();
    return;
  }

  if (phase !== "playing") return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    flippers.left.active = true;
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    flippers.right.active = true;
  } else if (event.key === " ") {
    event.preventDefault();
    if (!charging) charging = true;
  }
}

function handleKeyup(event) {
  if (event.key === "ArrowLeft") flippers.left.active = false;
  else if (event.key === "ArrowRight") flippers.right.active = false;
  else if (event.key === " ") {
    if (charging) {
      charging = false;
      launchBall();
    }
  }
}

/* --- Oppbygging av UI ---------------------------------------------------------------------- */

function buildStat(labelKey) {
  const box = el("div", "field-sunken pinball-stat");
  const label = el("p", "pinball-stat-label", STRINGS[lang][labelKey]);
  const value = el("p", "pinball-stat-value", "0");
  box.append(label, value);
  return { box, label, value };
}

/* Piltaster og mellomrom finnes ikke på en mobil skjerm — disse knappene
   speiler nøyaktig samme trykk/slipp-oppførsel som handleKeydown/-keyup. */
function buildTouchControls() {
  const row = el("div", "pinball-controls-mobile");

  const makeFlipperBtn = (label, flipperSide) => {
    const btn = el("button", "btn pinball-touch-btn", label);
    btn.type = "button";
    const release = () => {
      flippers[flipperSide].active = false;
    };
    btn.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (phase === "playing") flippers[flipperSide].active = true;
    });
    btn.addEventListener("pointerup", release);
    btn.addEventListener("pointerleave", release);
    btn.addEventListener("pointercancel", release);
    return btn;
  };

  const launchBtn = el("button", "btn pinball-touch-btn pinball-touch-launch", "⤒");
  launchBtn.type = "button";
  const releaseLaunch = () => {
    if (charging) {
      charging = false;
      launchBall();
    }
  };
  launchBtn.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    if (phase === "playing" && !charging) charging = true;
  });
  launchBtn.addEventListener("pointerup", releaseLaunch);
  launchBtn.addEventListener("pointerleave", releaseLaunch);
  launchBtn.addEventListener("pointercancel", releaseLaunch);

  row.append(makeFlipperBtn("◀", "left"), launchBtn, makeFlipperBtn("▶", "right"));
  return row;
}

function build() {
  const root = document.querySelector("#pinball-body");
  if (!root) return;

  const wrap = el("div", "pinball-wrap");
  const side = el("div", "pinball-side");

  const scoreStat = buildStat("pinball.score");
  const ballsStat = buildStat("pinball.balls");
  scoreValueEl = scoreStat.value;
  ballsValueEl = ballsStat.value;
  side.append(scoreStat.box, ballsStat.box);

  const boardWrap = el("div", "pinball-board-wrap");
  canvas = document.createElement("canvas");
  canvas.className = "pinball-board";
  overlayEl = el("div", "pinball-overlay");
  boardWrap.append(canvas, overlayEl);

  wrap.append(side, boardWrap, buildTouchControls());
  root.append(wrap);

  const dpr = window.devicePixelRatio || 1;
  canvas.width = TABLE_W * dpr;
  canvas.height = TABLE_H * dpr;
  canvas.style.width = `${TABLE_W}px`;
  canvas.style.height = `${TABLE_H}px`;
  ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
}

/* --- Offentlig API ------------------------------------------------------------------------- */

export function init() {
  winEl = document.querySelector('.window[data-window="pinball"]');
  statusEl = document.querySelector("#pinball-status");
  if (!winEl) return;

  build();
  resetBall();
  updateScoreDisplay();
  updateBallsDisplay();
  renderOverlay();
  render();

  document.addEventListener("keydown", handleKeydown);
  document.addEventListener("keyup", handleKeyup);
}

export function start() {
  /* Ingen server-data å hente — spillet er klart etter init(). */
}

export function setLanguage(next) {
  lang = next;
  renderOverlay();
  updateStatus();
}
