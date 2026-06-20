export const USE_MOCK = import.meta.env.DEV

// Fixed overlay layers (non-genre)
export const LAYERS = {
  want:        { rgb: { r: 155, g: 155, b: 165 }, label: 'Want to read',  ring: true,            desc: 'Books saved on your to-read list'                        },
  suggestions: { rgb: { r: 235, g: 230, b: 255 }, label: 'Suggestions',   ring: false, diamond: true, desc: 'Personalised picks based on your reading history'   },
  corpus:      { rgb: { r: 110, g: 95,  b: 135 }, label: 'Reference map',   ring: false, faded: true,  desc: 'Genre terrain map of the wider literary world'        },
  corpusDots:  { rgb: { r: 120, g: 100, b: 150 }, label: 'Reference books',  ring: false, faded: true,  desc: 'Individual books from the wider literary world as dots' },
}

// Named genre → star colour. Keys must match the `genre` strings the API returns.
export const GENRE_PALETTE = {
  'Fantasy':            { r: 150, g: 20,  b: 255 },
  'Science Fiction':    { r: 8,   g: 113, b: 190 },
  'History':            { r: 210, g: 150, b: 8   },
  'Historical Fiction': { r: 186, g: 97,  b: 0   },
  'Biography/Memoir':   { r: 117, g: 105, b: 255 },
  'Mystery':            { r: 162, g: 0,   b: 130 },
  'Psychology':         { r: 0,   g: 182, b: 223 },
  'Science/Nature':     { r: 101, g: 186, b: 0   },
  'Self Help':          { r: 20,  g: 190, b: 125 },
  'Romance':            { r: 255, g: 101, b: 134 },
  'Thriller':           { r: 219, g: 45,  b: 49  },
  'Classics':           { r: 130, g: 49,  b: 158 },
  'Fiction':            { r: 162, g: 150, b: 255 },
  'Nonfiction':         { r: 121, g: 134, b: 0   },
  'Horror':             { r: 154, g: 45,  b: 69  },
  'Graphic Novel':      { r: 247, g: 85,  b: 255 },
  'Art/Design':         { r: 215, g: 8,   b: 113 },
  'Economics/Business': { r: 0,   g: 117, b: 24  },
  'Food':               { r: 255, g: 109, b: 49  },
  'Philosophy':         { r: 186, g: 101, b: 247 },
  'Plays/Drama':        { r: 194, g: 0,   b: 215 },
  'Poetry':             { r: 202, g: 93,  b: 170 },
  'Politics':           { r: 89,  g: 73,  b: 178 },
  'Religion/Spirituality': { r: 150, g: 53, b: 0 },
  'Travel':             { r: 77,  g: 154, b: 255 },
}

// Seeded fallback colours for genres not in GENRE_PALETTE
const FALLBACK_POOL = [
  { r: 95,  g: 190, b: 210 }, { r: 195, g: 110, b: 255 }, { r: 240, g: 130, b: 90  },
  { r: 90,  g: 210, b: 155 }, { r: 220, g: 100, b: 190 }, { r: 160, g: 210, b: 90  },
]
const _fallbackCache = {}
export function genreRgb(genre) {
  if (!genre) return { r: 155, g: 140, b: 175 }
  if (GENRE_PALETTE[genre]) return GENRE_PALETTE[genre]
  if (!_fallbackCache[genre]) {
    let h = 0; for (let i = 0; i < genre.length; i++) h = (h * 31 + genre.charCodeAt(i)) >>> 0
    _fallbackCache[genre] = FALLBACK_POOL[h % FALLBACK_POOL.length]
  }
  return _fallbackCache[genre]
}

// Exact world-space bounds the terrain PNG was rendered over, taken from the notebook
// that generates genre_terrain.png. This is the PADDED density grid, which is wider than
// the corpus point extent, so the PNG must be placed with these values — not the dots'
// min/max. Refresh these (and the PNG) whenever the backend recomputes the projection,
// or the terrain will land out of place.
export const TERRAIN_BOUNDS = { minX: -6.4664, maxX: 20.5175, minY: -5.4341, maxY: 19.2843 }

export const STEPS = [
  'Reading your library…',
  'Matching against the book database…',
  'Looking up any unknown books…',
  'Understanding your taste…',
  'Building your map…',
  'Finding recommendations…',
]
