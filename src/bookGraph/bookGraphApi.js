import { USE_MOCK } from './bookGraphConfig.js'
import { SAMPLE_PLOT } from '../bookGraphSample.js'

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
