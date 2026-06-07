/* ─────────────────────────────────────────────────────────────────────────
   Deterministic sample PlotResponse used ONLY in local dev (import.meta.env.DEV).
   It lets the Book Graph page be developed and demoed without hitting the real
   API — which costs tokens — and guarantees the same plot every time.

   Coordinates are laid out as tight, well-separated genre clusters (the way a
   real UMAP projection of book embeddings tends to look), so the "groupings"
   idea reads clearly:
     • Fantasy / epic        ≈ (4,  15)
     • Space & hard sci-fi   ≈ (16, 7)
     • Dystopian classics    ≈ (15, 16)
     • Literary classics     ≈ (5,  4)
     • Non-fiction (lone)    ≈ (10, 11)
     • Thriller (lone)       ≈ (2,  9)
   Recommendations & want-to-read sit just beside their source cluster.

   Shape mirrors the live API's PlotResponse exactly (see the integration guide).
   ──────────────────────────────────────────────────────────────────────────── */
export const SAMPLE_PLOT = {
  read: [
    // ── Fantasy / epic ───────────────────────────────────────────────
    { x: 3.5, y: 15.7, title: 'The Hobbit', author: 'J.R.R. Tolkien', rating: 5, date_read: '2017/12/24' },
    { x: 3.7, y: 15.3, title: 'The Fellowship of the Ring', author: 'J.R.R. Tolkien', rating: 5, date_read: '2018/01/15' },
    { x: 4.5, y: 15.5, title: 'Mistborn (Mistborn, #1)', author: 'Brandon Sanderson', rating: 5, date_read: '2022/03/11' },
    { x: 4.7, y: 15.1, title: 'The Way of Kings (The Stormlight Archive, #1)', author: 'Brandon Sanderson', rating: 5, date_read: '2022/06/30' },
    { x: 4.2, y: 14.6, title: 'The Name of the Wind', author: 'Patrick Rothfuss', rating: 4, date_read: '2021/11/03' },
    { x: 4.4, y: 14.3, title: "The Wise Man's Fear", author: 'Patrick Rothfuss', rating: 4, date_read: '2021/12/19' },
    { x: 3.4, y: 14.9, title: 'The Poppy War (The Poppy War, #1)', author: 'R.F. Kuang', rating: 5, date_read: '2023/01/20' },
    { x: 3.6, y: 14.5, title: 'The Dragon Republic (The Poppy War, #2)', author: 'R.F. Kuang', rating: 4, date_read: '2023/02/15' },
    { x: 4.0, y: 15.9, title: 'A Game of Thrones', author: 'George R.R. Martin', rating: 4, date_read: '2020/07/22' },

    // ── Space opera & hard sci-fi ────────────────────────────────────
    { x: 15.6, y: 6.5, title: 'Dune (Dune, #1)', author: 'Frank Herbert', rating: 5, date_read: '2022/08/14' },
    { x: 15.9, y: 6.9, title: 'Dune Messiah (Dune, #2)', author: 'Frank Herbert', rating: 4, date_read: '2022/09/02' },
    { x: 16.4, y: 6.4, title: 'Project Hail Mary', author: 'Andy Weir', rating: 5, date_read: '2023/05/05' },
    { x: 16.6, y: 6.8, title: 'The Martian', author: 'Andy Weir', rating: 5, date_read: '2021/06/18' },
    { x: 15.4, y: 7.3, title: 'Neuromancer', author: 'William Gibson', rating: 3, date_read: '2020/12/01' },
    { x: 16.1, y: 7.5, title: 'Snow Crash', author: 'Neal Stephenson', rating: 4, date_read: '2022/01/27' },

    // ── Dystopian classics ───────────────────────────────────────────
    { x: 14.6, y: 16.1, title: '1984', author: 'George Orwell', rating: 5, date_read: '2019/05/01' },
    { x: 15.1, y: 15.9, title: 'Animal Farm', author: 'George Orwell', rating: 4, date_read: '2019/04/10' },
    { x: 14.9, y: 15.3, title: 'Brave New World', author: 'Aldous Huxley', rating: 3, date_read: '2019/09/09' },
    { x: 14.4, y: 15.6, title: 'Fahrenheit 451', author: 'Ray Bradbury', rating: 4, date_read: '2020/02/14' },

    // ── Literary classics ────────────────────────────────────────────
    { x: 4.4, y: 4.0, title: 'Pride and Prejudice', author: 'Jane Austen', rating: 4, date_read: '2018/03/03' },
    { x: 4.7, y: 4.4, title: 'Emma', author: 'Jane Austen', rating: 3, date_read: '2018/05/21' },
    { x: 5.2, y: 4.5, title: 'Jane Eyre', author: 'Charlotte Brontë', rating: 5, date_read: '2020/10/12' },
    { x: 5.0, y: 3.7, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', rating: 4, date_read: '2019/08/08' },
    { x: 4.5, y: 3.6, title: 'To Kill a Mockingbird', author: 'Harper Lee', rating: 4, date_read: '2021/01/03' },

    // ── Lone outliers ────────────────────────────────────────────────
    { x: 9.6, y: 10.8, title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', rating: 4, date_read: '2021/03/30' },
    { x: 1.8, y: 9.4, title: 'The Silent Patient', author: 'Alex Michaelides', rating: 0, date_read: 'unknown' },
  ],

  want: [
    { x: 3.5, y: 14.2, title: 'Babel', author: 'R.F. Kuang' },
    { x: 4.8, y: 15.4, title: 'Words of Radiance (The Stormlight Archive, #2)', author: 'Brandon Sanderson' },
    { x: 4.9, y: 15.0, title: 'A Trade of Blood (Shadow of the Leviathan, #3)', author: 'Robert Jackson Bennett' },
    { x: 16.2, y: 6.2, title: 'Artemis', author: 'Andy Weir' },
  ],

  recommendations: {
    new_authors: [
      { title: 'The Fifth Season', author: 'N.K. Jemisin', genre: 'Fantasy', score: 0.851, because_you_read: 'The Way of Kings (The Stormlight Archive, #1)', x: 4.9, y: 14.9 },
      { title: 'A Wizard of Earthsea', author: 'Ursula K. Le Guin', genre: 'Fantasy', score: 0.823, because_you_read: 'The Hobbit', x: 3.2, y: 15.4 },
      { title: 'The Blade Itself', author: 'Joe Abercrombie', genre: 'Grimdark Fantasy', score: 0.808, because_you_read: 'A Game of Thrones', x: 4.3, y: 16.2 },
      { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', genre: 'Literary Sci-Fi', score: 0.781, because_you_read: 'Brave New World', x: 15.0, y: 14.8 },
      { title: 'Children of Time', author: 'Adrian Tchaikovsky', genre: 'Science Fiction', score: 0.776, because_you_read: 'Project Hail Mary', x: 16.8, y: 6.5 },
      { title: 'Mockingbird: A Portrait of Harper Lee', author: 'Charles J. Shields', genre: 'Biography', score: 0.742, because_you_read: 'To Kill a Mockingbird', x: 4.2, y: 3.3 },
    ],
    familiar_authors: [
      { title: 'God Emperor of Dune', author: 'Frank Herbert', genre: 'Science Fiction', score: 0.861, because_you_read: 'Dune Messiah (Dune, #2)', x: 15.7, y: 7.1 },
      { title: 'Oathbringer (The Stormlight Archive, #3)', author: 'Brandon Sanderson', genre: 'Fantasy', score: 0.857, because_you_read: 'The Way of Kings (The Stormlight Archive, #1)', x: 5.0, y: 15.2 },
      { title: 'The Burning God (The Poppy War, #3)', author: 'R.F. Kuang', genre: 'Fantasy', score: 0.840, because_you_read: 'The Dragon Republic (The Poppy War, #2)', x: 3.3, y: 14.6 },
      { title: 'A Clash of Kings', author: 'George R.R. Martin', genre: 'Fantasy', score: 0.834, because_you_read: 'A Game of Thrones', x: 4.2, y: 16.1 },
      { title: 'The Two Towers', author: 'J.R.R. Tolkien', genre: 'Fantasy', score: 0.829, because_you_read: 'The Fellowship of the Ring', x: 3.9, y: 15.5 },
      { title: 'The Slow Regard of Silent Things', author: 'Patrick Rothfuss', genre: 'Fantasy', score: 0.798, because_you_read: "The Wise Man's Fear", x: 4.6, y: 14.1 },
    ],
  },

  meta: {
    read_count: 26,
    miss_count: 0,
    excluded_count: 88,
    enrich_timed_out: false,
    elapsed_ms: 0,
  },
}
