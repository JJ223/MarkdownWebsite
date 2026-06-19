/* ─────────────────────────────────────────────────────────────────────────
   Deterministic sample PlotResponse used ONLY in local dev (import.meta.env.DEV).
   It lets the Book Graph page be developed and demoed without hitting the real
   API — which costs tokens — and guarantees the same plot every time.

   Every `*.json` under `testMap/` is a saved run of the live API, already in the
   shape the page consumes (`{ read, want, recommendations, meta }`). They're all
   loaded eagerly and keyed by filename, so switching maps is a one-line change to
   SAMPLE below and dropping a new file in `testMap/` registers it automatically.
   ──────────────────────────────────────────────────────────────────────────── */

// ── Pick which testMap to plot in dev. Use the filename without `.json`. ──────
const SAMPLE = 'Mine'

const runs = import.meta.glob('../testMap/*.json', { eager: true, import: 'default' })

// Map "../testMap/Mine.json" → "Mine"
const byName = Object.fromEntries(
  Object.entries(runs).map(([path, data]) => [path.match(/([^/]+)\.json$/)[1], data])
)

export const SAMPLE_NAMES = Object.keys(byName)

export const SAMPLE_PLOT =
  byName[SAMPLE] ?? byName[SAMPLE_NAMES[0]] // fall back to whatever's there

// Mock corpus for dev: loaded from testMap/Corpus.json (a saved run of GET /api/books/corpus).
// Handles whichever shape the endpoint returns: array, { points }, or { books }.
// Falls back to an empty array until the file is populated via build_projection.
const _corpusRaw = byName['Corpus']
const _corpusPts = Array.isArray(_corpusRaw)
  ? _corpusRaw
  : Array.isArray(_corpusRaw?.points) ? _corpusRaw.points
  : Array.isArray(_corpusRaw?.books)  ? _corpusRaw.books
  : []
export const SAMPLE_CORPUS = _corpusPts.map(p => ({ x: p.x, y: p.y, genre: p.genre || '', title: p.title || '', author: p.author || '' }))
