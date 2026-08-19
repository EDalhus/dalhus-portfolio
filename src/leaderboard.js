/**
 * Highscore-listen for Tetris, lagret i Workers KV.
 *
 * Ett endepunkt, to metoder:
 *   GET  /api/leaderboard        — topplisten
 *   POST /api/leaderboard        — { name, score, level?, lines? } → oppdatert liste
 *
 * Merk: dette er en åpen, ikke-autentisert skriveendepunkt. Alt som stopper
 * noen fra å POSTe en falsk score direkte er sanering og et tak på verdien
 * — det finnes ingen server-side verifisering av at scoren faktisk ble
 * spilt. Helt greit for en portefølje-lekeplass, men verdt å vite.
 */

const KEY = "leaderboard";
const MAX_ENTRIES = 20;
const MAX_NAME_LENGTH = 12;
const MAX_SCORE = 999_999;
const MAX_LEVEL = 99;
const MAX_LINES = 9_999;
const CONTROL_CHARS = new RegExp("[\\u0000-\\u001f\\u007f]", "g");

function clampInt(raw, fallback, min, max) {
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function sanitizeName(raw) {
  const trimmed = String(raw ?? "")
    .replace(CONTROL_CHARS, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH);
  return trimmed || "???";
}

async function readEntries(env) {
  const raw = await env.LEADERBOARD.get(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
      "cache-control": "no-store",
    },
  });
}

export async function handleLeaderboardRequest(request, env) {
  if (request.method === "GET") {
    return json({ entries: await readEntries(env) });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Ugyldig JSON." }, 400);
    }

    const score = Number.parseInt(body?.score, 10);
    if (!Number.isFinite(score) || score < 0 || score > MAX_SCORE) {
      return json({ error: "Ugyldig poengsum." }, 400);
    }

    const entry = {
      name: sanitizeName(body?.name),
      score,
      level: clampInt(body?.level, 0, 0, MAX_LEVEL),
      lines: clampInt(body?.lines, 0, 0, MAX_LINES),
      date: new Date().toISOString(),
    };

    const entries = await readEntries(env);
    entries.push(entry);
    entries.sort((a, b) => b.score - a.score);
    const rank = entries.indexOf(entry) + 1;
    const top = entries.slice(0, MAX_ENTRIES);

    await env.LEADERBOARD.put(KEY, JSON.stringify(top));

    return json({ entries: top, rank, madeTop: rank <= MAX_ENTRIES });
  }

  return new Response("Method Not Allowed", { status: 405, headers: { allow: "GET, POST" } });
}
