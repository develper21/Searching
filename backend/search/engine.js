/**
 * A tiny Google-style search engine for tasks.
 *
 * Pipeline (same methodology as a real search engine, scaled down):
 *   1. CRAWL/STORE   -> documents (tasks) live in db.json, loaded into memory
 *   2. INDEX         -> per-field inverted index: term -> postings (docId -> term frequency)
 *   3. RANK          -> BM25 scoring per field with field weights + phrase/exact/recency boosts
 *   4. AUTOCOMPLETE  -> prefix completion over the term vocabulary + title-phrase dictionary
 *   5. DID YOU MEAN  -> Damerau-Levenshtein nearest vocabulary term
 *   6. RELATED       -> top terms harvested from the best-ranked documents
 */

const FIELD_WEIGHTS = { title: 2.5, description: 1, status: 0.6 };
const BM25_K1 = 1.2;
const BM25_B = 0.75;
const PREFIX_TERM_LIMIT = 40;
const PREFIX_BOOST = 0.35;
const PHRASE_BONUS = 2.5;
const EXACT_TITLE_BONUS = 6;

/** Words too generic to be useful as related-search terms. */
const STOPWORDS = new Set([
  "and", "the", "with", "for", "basics", "basic", "learn", "using", "how",
  "your", "you", "from", "into", "that", "this", "are", "not", "was",
]);

/** Lowercase, keep internal dots/+/# (next.js, c++), collapse whitespace. */
function normalize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s.+#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split into tokens, stripping punctuation stuck to token edges. */
function tokenize(text) {
  return normalize(text)
    .split(" ")
    .map((t) => t.replace(/^[.+#-]+|[.+#-]+$/g, ""))
    .filter(Boolean);
}

/** Damerau-Levenshtein distance with an early length filter. */
function editDistance(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const d = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[a.length][b.length];
}

class TaskSearchEngine {
  constructor() {
    this.docs = new Map();
    this.rebuild([]);
  }

  /** Wipe and rebuild the whole index from a task array. Data is tiny, so a
   *  full rebuild on every mutation keeps the index always-consistent. */
  rebuild(tasks) {
    this.index = { title: new Map(), description: new Map(), status: new Map() };
    this.docLen = { title: new Map(), description: new Map(), status: new Map() };
    this.avgLen = { title: 1, description: 1, status: 1 };
    this.termPopularity = new Map(); // term -> weighted total occurrences
    this.phrases = new Map(); // normalized title -> { text, taskId }
    this.N = 0;
    this.docs = new Map();
    tasks.forEach((task) => this.addDocument(task));
  }

  addDocument(task) {
    const doc = { ...task, tokens: {} };
    this.docs.set(String(task.id), doc);
    this.N += 1;
    for (const field of Object.keys(FIELD_WEIGHTS)) {
      const tokens = tokenize(task[field] || "");
      doc.tokens[field] = tokens;
      this.docLen[field].set(String(task.id), tokens.length);
      for (const term of tokens) {
        let postings = this.index[field].get(term);
        if (!postings) {
          postings = new Map();
          this.index[field].set(term, postings);
        }
        postings.set(String(task.id), (postings.get(String(task.id)) || 0) + 1);
        this.termPopularity.set(term, (this.termPopularity.get(term) || 0) + FIELD_WEIGHTS[field]);
      }
    }
    const titleNorm = normalize(task.title || "");
    if (titleNorm) this.phrases.set(titleNorm, { text: (task.title || "").trim(), taskId: String(task.id) });
    this.computeAvgLengths();
  }

  removeDocument(id) {
    const doc = this.docs.get(String(id));
    if (!doc) return;
    for (const field of Object.keys(FIELD_WEIGHTS)) {
      for (const term of doc.tokens[field]) {
        const postings = this.index[field].get(term);
        if (!postings) continue;
        postings.delete(String(id));
        if (postings.size === 0) this.index[field].delete(term);
        this.termPopularity.set(term, (this.termPopularity.get(term) || 1) - FIELD_WEIGHTS[field]);
        if ((this.termPopularity.get(term) || 0) <= 0) this.termPopularity.delete(term);
      }
      this.docLen[field].delete(String(id));
    }
    const titleNorm = normalize(doc.title || "");
    if (this.phrases.get(titleNorm)?.taskId === String(id)) this.phrases.delete(titleNorm);
    this.docs.delete(String(id));
    this.N = Math.max(0, this.N - 1);
    this.computeAvgLengths();
  }

  computeAvgLengths() {
    for (const field of Object.keys(FIELD_WEIGHTS)) {
      const lens = [...this.docLen[field].values()];
      this.avgLen[field] = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 1;
    }
  }

  bm25(tf, df, docLen, field) {
    const idf = Math.log(1 + (this.N - df + 0.5) / (df + 0.5));
    const avg = this.avgLen[field] || 1;
    return (idf * (tf * (BM25_K1 + 1))) / (tf + BM25_K1 * (1 - BM25_B + BM25_B * (docLen / avg)));
  }

  recencyBoost(createdAt) {
    if (!createdAt) return 0;
    const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
    return Math.max(0, 1 - days / 30) * 0.8;
  }

  /** Suggest completions for a partial query. `extras` are recents/trending
   *  items blended in Google-style: { text, type, score }. */
  suggest(rawQuery, extras = []) {
    const out = [];
    const seen = new Set();
    const push = (text, type, score) => {
      const key = (text || "").toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ text, type, score });
    };
    extras.forEach((e) => push(e.text, e.type, e.score));

    const norm = normalize(rawQuery);
    const tokens = tokenize(rawQuery);

    if (!tokens.length) {
      [...this.phrases.values()].slice(0, 5).forEach((p) => push(p.text, "phrase", 10));
      return out.sort((a, b) => b.score - a.score).slice(0, 8).map(({ text, type }) => ({ text, type }));
    }

    const last = tokens[tokens.length - 1];
    const head = tokens.slice(0, -1).join(" ");

    // 1) Phrase suggestions (title dictionary) — like Google's query completions.
    for (const [normPhrase, meta] of this.phrases) {
      let s = 0;
      if (normPhrase === norm) s = 200;
      else if (normPhrase.startsWith(norm)) s = 120 + norm.length / normPhrase.length;
      else if (normPhrase.includes(" " + norm)) s = 60;
      if (s) push(meta.text, "phrase", s * 10);
    }

    // 2) Term completions for the word being typed.
    const vocab = [...this.termPopularity.entries()];
    let completions = 0;
    const correctionCandidates = [];
    for (const [term, pop] of vocab) {
      if (term.startsWith(last)) {
        push(head ? `${head} ${term}` : term, "completion", 80 + pop);
        completions += 1;
      } else if (Math.abs(term.length - last.length) <= 3) {
        correctionCandidates.push({ term, pop });
      }
    }

    // 3) Did-you-mean inside the dropdown when nothing completes the word.
    if (completions === 0 && !this.termPopularity.has(last)) {
      const maxDist = Math.max(2, Math.floor(last.length / 3));
      correctionCandidates
        .map((c) => ({ ...c, dist: editDistance(last, c.term, maxDist) }))
        .filter((c) => c.dist <= maxDist)
        .sort((a, b) => a.dist - b.dist || b.pop - a.pop)
        .slice(0, 2)
        .forEach((c) => push(head ? `${head} ${c.term}` : c.term, "correction", 40 - c.dist));
    }

    return out.sort((a, b) => b.score - a.score).slice(0, 8).map(({ text, type }) => ({ text, type }));
  }

  /** Best correction for the whole query, or null. */
  didYouMean(tokens) {
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (this.termPopularity.has(token)) continue;
      const maxDist = Math.max(2, Math.floor(token.length / 3));
      let best = null;
      for (const [term, pop] of this.termPopularity) {
        if (Math.abs(term.length - token.length) > maxDist) continue;
        const dist = editDistance(token, term, maxDist);
        if (dist <= maxDist && (!best || dist < best.dist || (dist === best.dist && pop > best.pop))) {
          best = { term, dist, pop };
        }
      }
      if (best) {
        const corrected = [...tokens];
        corrected[i] = best.term;
        return corrected.join(" ");
      }
    }
    return null;
  }

  relatedSearches(queryTokens, results) {
    const querySet = new Set(queryTokens);
    const counts = new Map();
    results.slice(0, 5).forEach((doc) => {
      tokenize(doc.title).forEach((term) => {
        if (querySet.has(term) || term.length < 3 || STOPWORDS.has(term)) return;
        counts.set(term, (counts.get(term) || 0) + 2);
      });
      tokenize(doc.description).forEach((term) => {
        if (querySet.has(term) || term.length < 3 || STOPWORDS.has(term)) return;
        counts.set(term, (counts.get(term) || 0) + 1);
      });
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || (this.termPopularity.get(b[0]) || 0) - (this.termPopularity.get(a[0]) || 0))
      .slice(0, 4)
      .map(([term]) => term);
  }

  /** Full search: rank, boost, filter, sort. */
  search(rawQuery, { status = "", limit = 50 } = {}) {
    const started = Date.now();
    const norm = normalize(rawQuery);
    const tokens = tokenize(rawQuery);
    if (!tokens.length) {
      return { query: "", results: [], total: 0, tookMs: Date.now() - started, didYouMean: null, related: [] };
    }

    const scores = new Map(); // id -> { score, matched:Set }
    const bump = (id, amount, term) => {
      let entry = scores.get(id);
      if (!entry) {
        entry = { score: 0, matched: new Set() };
        scores.set(id, entry);
      }
      entry.score += amount;
      if (term) entry.matched.add(term);
    };

    tokens.forEach((token, ti) => {
      const isLast = ti === tokens.length - 1;
      let direct = false;
      for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
        const postings = this.index[field].get(token);
        if (!postings) continue;
        direct = true;
        const df = postings.size;
        for (const [id, tf] of postings) {
          bump(id, weight * this.bm25(tf, df, this.docLen[field].get(id) || 1, field), token);
        }
      }
      // Prefix matching on the word still being typed (like Google instant search).
      if (!direct && isLast) {
        const prefixTerms = [...this.termPopularity.keys()].filter((t) => t.startsWith(token)).slice(0, PREFIX_TERM_LIMIT);
        for (const term of prefixTerms) {
          for (const [field, weight] of Object.entries(FIELD_WEIGHTS)) {
            const postings = this.index[field].get(term);
            if (!postings) continue;
            const df = postings.size;
            for (const [id, tf] of postings) {
              bump(id, PREFIX_BOOST * weight * this.bm25(tf, df, this.docLen[field].get(id) || 1, field), term);
            }
          }
        }
      }
    });

    // Phrase / exact-title / recency boosts.
    for (const [id, doc] of this.docs) {
      const entry = scores.get(id);
      if (!entry) continue;
      const titleNorm = normalize(doc.title);
      if (titleNorm === norm) entry.score += EXACT_TITLE_BONUS;
      else if (titleNorm.startsWith(norm)) entry.score += PHRASE_BONUS + 1;
      else if (titleNorm.includes(norm)) entry.score += PHRASE_BONUS;
      entry.score += this.recencyBoost(doc.createdAt);
    }

    const didYouMean = this.didYouMean(tokens);
    let results = [...scores.entries()]
      .filter(([, e]) => e.score > 0)
      .map(([id, e]) => {
        const { tokens: _tokens, ...task } = this.docs.get(id);
        return { ...task, score: Math.round(e.score * 1000) / 1000, matchedTerms: [...e.matched] };
      })
      .sort((a, b) => b.score - a.score || new Date(b.createdAt) - new Date(a.createdAt));

    if (status) results = results.filter((r) => r.status === status);

    return {
      query: norm,
      results: results.slice(0, limit),
      total: results.length,
      tookMs: Date.now() - started,
      didYouMean,
      related: this.relatedSearches(tokens, results),
    };
  }
}

module.exports = { TaskSearchEngine, normalize, tokenize, editDistance };
