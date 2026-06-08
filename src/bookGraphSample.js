/* ─────────────────────────────────────────────────────────────────────────
   Deterministic sample PlotResponse used ONLY in local dev (import.meta.env.DEV).
   It lets the Book Graph page be developed and demoed without hitting the real
   API — which costs tokens — and guarantees the same plot every time.

   The sample is the real plot captured under `testMap/` (a saved run of the live
   API). That file wraps the PlotResponse in a `response` envelope, so we unwrap
   it here to match the shape the page consumes (`{ read, want, recommendations,
   meta }`).
   ──────────────────────────────────────────────────────────────────────────── */
import savedRun from '../testMap/20260607T223833Z_fa6b9fc3.json'

export const SAMPLE_PLOT = savedRun.response
