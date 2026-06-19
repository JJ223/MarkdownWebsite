import { USE_MOCK } from './bookGraphConfig.js'
import { SAMPLE_PLOT, SAMPLE_CORPUS } from '../bookGraphSample.js'

export async function plotBooks(file, signal) {
  if (USE_MOCK) {
    await new Promise(r => setTimeout(r, 1600))
    return SAMPLE_PLOT
  }
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/books/plot', { method: 'POST', body: form, signal })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchCorpus() {
  if (USE_MOCK) {
    // Use Large.json's read books — a different library that spreads across the full
    // UMAP space — so the faded reference layer is visible behind the user's own stars.
    await new Promise(r => setTimeout(r, 200))
    return SAMPLE_CORPUS
  }
  const res = await fetch('/api/books/corpus')
  if (!res.ok) return null
  const data = await res.json().catch(() => null)
  if (!data) return null
  // Accept: array directly, { points }, or { books }
  if (Array.isArray(data)) return data
  if (Array.isArray(data.points)) return data.points
  if (Array.isArray(data.books)) return data.books
  return null
}
