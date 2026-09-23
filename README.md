# TaskFlow — Task Management with a Google-style Search Engine

Full-stack task manager jisme search ek proper **search-engine pipeline** hai (jaise Google karta hai) — sirf `String.includes()` filter nahi.

## Features

- **Google-style autocomplete**: ek-ek letter pe live suggestions — phrase completions (titles se), term completions (vocabulary se), recent searches aur trending queries badges ke saath
- **Did you mean?**: typo queries pe spelling correction (Damerau-Levenshtein)
- **Ranked results**: BM25 relevance scoring — results random order mein nahi, relevance se sorted
- **Match highlighting**: matched words results mein highlight
- **Related searches**: top results ke terms se suggest kiye jaate hain
- **Recents + Trending**: session ke popular queries dropdown aur home page pe
- **Prefix search**: aadha likha word bhi match karta hai (`doc` → `docker`)
- **Status filter** results ke andar, full CRUD, glassmorphism + minimal UI

## Technology Stack

- **Frontend**: React 19 + Vite, Axios, pure CSS (glassmorphism design system)
- **Backend**: Node.js + Express — custom in-memory search engine (`backend/search/engine.js`)
- **Database**: `db.json` (single source of truth, index har mutation pe rebuild hota hai)

## Search Engine Methodology (backend/search/engine.js)

Real search engines jaisa scaled-down pipeline:

1. **Crawl/Store** → tasks `db.json` mein documents ki tarah
2. **Index** → per-field **inverted index**: `term → { docId → term frequency }` (title, description, status alag indices)
3. **Rank** → **BM25** scoring har field pe, field weights ke saath (`title: 2.5, description: 1, status: 0.6`), plus boosts:
   - exact-title match (+6), title phrase match (+2.5), prefix match (+0.35), recency (naye tasks upar)
4. **Autocomplete** → vocabulary prefix-completion + title-phrase dictionary + recents/trending blend
5. **Did you mean** → Damerau-Levenshtein distance se nearest vocabulary term
6. **Related** → best-ranked documents ke top terms (stopwords filtered)

## API

| Endpoint | Kya karta hai |
|---|---|
| `GET /tasks`, `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id` | CRUD |
| `GET /api/search?q=&status=` | Ranked results + `didYouMean` + `related` + `tookMs` |
| `GET /api/suggest?q=` | Autocomplete dropdown items (`phrase` / `completion` / `correction`) |
| `POST /api/search/click` | Query popularity record (trending ke liye) |
| `GET /api/trending`, `GET /api/recents`, `POST /api/recents/clear` | Session search stats |

## Run

```bash
cd backend  && npm install && npm start   # http://localhost:5000
cd frontend && npm install && npm run dev # http://localhost:5173
```

## Deployment (Render + Netlify)

Deploy order: **pehle backend (Render), phir frontend (Netlify)** — kyunki frontend build mein backend URL bake hota hai.

### 1. Backend → Render

Repo push karne ke baad:
- Render dashboard → **New → Blueprint** → repo select karo → `render.yaml` auto-detect hoga (`taskflow-api` web service, free plan, `/health` health-check).
- Deploy ke baad URL milega, e.g. `https://taskflow-api.onrender.com`.
- **Environment → `CORS_ORIGINS`** mein apni Netlify URL daalo (comma-separated multiple allowed), e.g. `https://taskflow.netlify.app` → save → auto-redeploy.
- Free plan pe cold-start hota hai (~30-50s pehli request pe) — tabhi `/health` se wake karo.

### 2. Frontend → Netlify

- Netlify → **Add new site → Import from Git** → repo select karo → `netlify.toml` sab auto-set karta hai (base `frontend`, build `npm run build`, publish `dist`, SPA redirect).
- Deploy se **pehle** `frontend/.env.production` mein `VITE_API_URL=<tumhara-render-url>` update karo (ya Netlify → Site settings → Environment variables mein `VITE_API_URL` set karo — dashboard value override karti hai).

### Env files

| File | Kahan | Kab use | Git? |
|---|---|---|---|
| `.env.example` | dono folders | template — copy karke `.env.local` banao | committed |
| `.env.local` | dono folders | local dev | **git-ignored** |
| `.env.production` | dono folders | production build (Vite inline karta hai) | committed (non-secret URLs) |

- **Frontend vars** `VITE_` prefix se shuru hone chahiye (Vite requirement).
- **Backend** `dotenv` se `.env.local`/`.env.production` read karta hai; Render ka `PORT`/env isse override hota hai.
- Values badalne ke baad frontend ka **rebuild/redeploy zaroori** hai (URL bundle mein bake hota hai).

### 3. Dono connect

```txt
Browser (Netlify site)  →  fetch https://<render-url>/tasks, /api/search, ...
Render backend          →  CORS_ORIGINS=https://<netlify-url>  (allowlist)
```

URLs final hone ke baad dono jagah update karo:
1. `frontend/.env.production` → `VITE_API_URL=https://<render-url>`
2. Render env → `CORS_ORIGINS=https://<netlify-url>`
3. Dono redeploy.

Verify: `https://<render-url>/health` browser mein `"ok":true` dikhna chahiye.

## Frontend Search UX (Google jaisa)

- Type karte hi **debounced (120ms) suggest API** calls, purani request **AbortController** se cancel
- Empty search pe focus karne se **recents + trending** dikhte hain
- **Keyboard navigation**: ↑/↓ se suggest pe browse, Enter se commit, Escape se close
- Suggestion pick ya Enter → **results view**: query, result count, `X results · Y ms`, did-you-mean, related chips, highlighted cards
- Result pe click/commit se backend click record hota hai → trending update

## Project Structure

```
project/
├── netlify.toml            # Netlify config (build + SPA redirect)
├── render.yaml             # Render blueprint (backend service)
├── backend/
│   ├── server.js           # Express: CRUD + search API (+ /health, CORS allowlist)
│   ├── search/engine.js    # Inverted index + BM25 + autocomplete + corrections
│   ├── db.json             # Database (source of truth)
│   └── .env.example / .env.local / .env.production
└── frontend/
    ├── .env.example / .env.local / .env.production
    └── src/
    └── src/
        ├── components/
        │   ├── SearchBar.jsx   # Debounced autocomplete + keyboard nav
        │   ├── Navbar.jsx, TaskList.jsx (highlighting), TaskForm.jsx, Notification.jsx
        ├── pages/Home.jsx      # Home + results view
        └── services/api.js     # REST + search API client (VITE_API_URL-driven)
```
