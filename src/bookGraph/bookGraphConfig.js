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
  'Fantasy':            { r: 140, g: 90,  b: 255 },
  'Science Fiction':    { r: 70,  g: 170, b: 255 },
  'History':            { r: 210, g: 175, b: 85  },
  'Historical Fiction': { r: 200, g: 145, b: 70  },
  'Biography/Memoir':   { r: 75,  g: 205, b: 185 },
  'Mystery':            { r: 215, g: 75,  b: 115 },
  'Psychology':         { r: 175, g: 95,  b: 225 },
  'Science/Nature':     { r: 75,  g: 200, b: 115 },
  'Self Help':          { r: 230, g: 160, b: 85  },
  'Romance':            { r: 250, g: 125, b: 165 },
  'Thriller':           { r: 225, g: 85,  b: 75  },
  'Classics':           { r: 200, g: 190, b: 135 },
  'Fiction':            { r: 160, g: 125, b: 255 },
  'Nonfiction':         { r: 145, g: 178, b: 218 },
  'Horror':             { r: 180, g: 60,  b: 90  },
  'Graphic Novel':      { r: 255, g: 145, b: 70  },
  'Art/Design':         { r: 230, g: 110, b: 85  },
  'Economics/Business': { r: 55,  g: 165, b: 125 },
  'Food':               { r: 245, g: 175, b: 45  },
  'Philosophy':         { r: 85,  g: 65,  b: 185 },
  'Plays/Drama':        { r: 160, g: 45,  b: 80  },
  'Poetry':             { r: 195, g: 150, b: 245 },
  'Politics':           { r: 80,  g: 110, b: 180 },
  'Religion/Spirituality': { r: 200, g: 160, b: 75 },
  'Travel':             { r: 90,  g: 200, b: 225 },
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
