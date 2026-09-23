/**
 * Task Manager backend.
 *
 * Serves two things:
 *  1. CRUD REST API for tasks  -> /tasks            (same contract as before)
 *  2. Google-style search API  -> /api/search, /api/suggest, /api/trending...
 *
 * db.json remains the single source of truth. Every mutation rebuilds the
 * in-memory search index, so search always reflects the latest data.
 */

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { TaskSearchEngine, tokenize } = require("./search/engine");

// .env.local / .env.production load karo (Render ka PORT env override karega — dotenv existing env ko override nahi karta)
require("dotenv").config();

const DB_FILE = path.join(__dirname, "db.json");
const PORT = Number(process.env.PORT) > 0 ? Number(process.env.PORT) : 5000;

// ---------- storage (db.json is the database) ----------
function loadDB() {
  const raw = fs.readFileSync(DB_FILE, "utf8");
  const db = JSON.parse(raw);
  if (!Array.isArray(db.tasks)) db.tasks = [];
  return db;
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

const db = loadDB();
const engine = new TaskSearchEngine();
engine.rebuild(db.tasks);

// ---------- app ----------
const app = express();

// CORS allowlist — deployment pe frontend URL env se aata hai (comma-separated multiple allowed).
// CORS_ORIGINS set na ho to open (local dev ke liye theek).
const corsOrigins = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : {}));
app.use(express.json());

// Health check — Render health check + uptime monitors ke liye
app.get("/health", (_req, res) =>
  res.json({ ok: true, tasks: db.tasks.length, uptimeSec: Math.round(process.uptime()) })
);

// Root -> service info (browser mein backend URL kholo to ye dikhta hai)
app.get("/", (_req, res) =>
  res.json({
    service: "taskflow-api",
    endpoints: ["/tasks", "/api/search", "/api/suggest", "/api/trending", "/api/recents", "/health"],
  })
);

const STATUSES = ["Not Started", "In Progress", "Completed"];

function cleanTask(body) {
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const status = STATUSES.includes(body.status) ? body.status : "Not Started";
  if (!title) return null;
  return {
    title,
    description,
    status,
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------- CRUD ----------
app.get("/tasks", (_req, res) => res.json(db.tasks));

app.get("/tasks/:id", (req, res) => {
  const task = db.tasks.find((t) => String(t.id) === String(req.params.id));
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.post("/tasks", (req, res) => {
  const clean = cleanTask(req.body || {});
  if (!clean) return res.status(400).json({ error: "Title is required" });
  const task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ...clean };
  db.tasks.unshift(task);
  saveDB(db);
  engine.addDocument(task);
  res.status(201).json(task);
});

app.put("/tasks/:id", (req, res) => {
  const idx = db.tasks.findIndex((t) => String(t.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Task not found" });
  const clean = cleanTask({ ...db.tasks[idx], ...req.body });
  if (!clean) return res.status(400).json({ error: "Title is required" });
  const updated = { id: db.tasks[idx].id, ...clean };
  db.tasks[idx] = updated;
  saveDB(db);
  engine.rebuild(db.tasks);
  res.json(updated);
});

app.delete("/tasks/:id", (req, res) => {
  const idx = db.tasks.findIndex((t) => String(t.id) === String(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Task not found" });
  const [removed] = db.tasks.splice(idx, 1);
  saveDB(db);
  engine.removeDocument(removed.id);
  res.status(204).end();
});

// ---------- search engine API ----------

// GET /api/search?q=... -> ranked results + didYouMean + related searches
app.get("/api/search", (req, res) => {
  const q = String(req.query.q || "");
  const status = String(req.query.status || "");
  const out = engine.search(q, { status, limit: 50 });
  // typo queries (with a did-you-mean) don't pollute recents/trending
  if (!out.didYouMean) trendingQueries.record(q);
  res.json(out);
});

// GET /api/suggest?q=... -> Google-style autocomplete dropdown items
app.get("/api/suggest", (req, res) => {
  const q = String(req.query.q || "");
  const extras = trendingQueries.suggestExtras(q);
  res.json({ query: q, suggestions: engine.suggest(q, extras) });
});

// POST /api/search/click -> user picked a result; boost its query popularity
app.post("/api/search/click", (req, res) => {
  const q = String((req.body || {}).q || "");
  if (q) trendingQueries.record(q);
  res.json({ ok: true });
});

// GET /api/trending -> most searched terms this session
app.get("/api/trending", (_req, res) => res.json({ trending: trendingQueries.top(6) }));

// GET /api/recents -> recent distinct successful searches this session
app.get("/api/recents", (_req, res) => res.json({ recents: trendingQueries.recents(8) }));

// POST /api/recents/clear
app.post("/api/recents/clear", (_req, res) => {
  trendingQueries.clearRecents();
  res.json({ ok: true });
});

/**
 * Session-scoped query popularity tracker.
 * - counts real searches (and clicked ones double-weighted)
 * - keeps a recents ring for the dropdown
 * - trending = high-count terms harvested from those queries
 */
const trendingQueries = {
  counts: new Map(),
  recentsList: [],

  record(q, weight = 1) {
    const tokens = tokenize(q);
    if (!tokens.length) return;
    const norm = tokens.join(" ");
    this.counts.set(norm, (this.counts.get(norm) || 0) + weight);
    this.recentsList = [norm, ...this.recentsList.filter((r) => r !== norm)].slice(0, 8);
  },

  recents(n) {
    return this.recentsList.slice(0, n);
  },

  top(n) {
    return [...this.counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([q]) => q);
  },

  /** Recents/trending entries to blend into autocomplete for the current prefix. */
  suggestExtras(q) {
    const norm = tokenize(q).join(" ");
    const extras = [];
    for (const recent of this.recentsList) {
      if (norm && !recent.startsWith(norm)) continue;
      extras.push({ text: recent, type: "recent", score: 500 - extras.length });
    }
    for (const [query] of [...this.counts.entries()].sort((a, b) => b[1] - a[1])) {
      if (norm && !query.startsWith(norm)) continue;
      if (this.recentsList.includes(query)) continue;
      extras.push({ text: query, type: "trending", score: 200 });
    }
    return extras.slice(0, 4);
  },

  clearRecents() {
    this.recentsList = [];
  },
};

app.listen(PORT, () => {
  console.log(`Task API + search engine running on http://localhost:${PORT}`);
});
