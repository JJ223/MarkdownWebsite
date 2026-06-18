export const USE_MOCK = import.meta.env.DEV

export const LAYERS = {
  read:        { rgb: { r: 170, g: 120, b: 255 }, label: 'Your books',   ring: false },
  want:        { rgb: { r: 222, g: 216, b: 244 }, label: 'Want to read', ring: false },
  suggestions: { rgb: { r: 120, g: 150, b: 255 }, label: 'Suggestions',  ring: true  },
}

export const STEPS = [
  'Reading your library…',
  'Matching against the book database…',
  'Looking up any unknown books…',
  'Understanding your taste…',
  'Building your map…',
  'Finding recommendations…',
]
