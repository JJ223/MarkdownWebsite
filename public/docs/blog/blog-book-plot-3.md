---
title: "From dots to districts: building BookGraph's genre system"
date: 2026-06-30
description: How I turned 1,029 uncontrolled Goodreads tags into 22 meaningful genres using position-aware bucket mapping, then rendered the result as a density-driven SVG terrain that shows the actual shape of the literary world.
tags: [Machine Learning, Visualization, Genre Mapping, Self-hosted]
---

# From dots to districts: building BookGraph's genre system

<div class="article-banner"><img src="/images/blog-book-plot-3.png" alt="Book Plot — an interactive star-map of a reading history" style="height:auto"/></div>

## Why genre matters for a map

The original BookGraph map answered one question well: *how close are your books to each other?* Sanderson and Tolkien cluster. Feynman and Sagan cluster. That's useful. What it doesn't tell you is *what region you're looking at* when you see a dense blob in the corner. Hover one dot at a time and you'll figure it out eventually, but you can't see the terrain — the underlying shape of the literary world — just by looking at where your own books happen to fall.

Genre coloring fixes this by adding a second layer of meaning. Every dot gets a color that answers "what is this?" and the corpus — the 2K anchor books that define the coordinate system — is drawn behind it as a colored landscape. Now the map has neighborhoods. You can see that you mostly live in the Fantasy district, that there's a Science Fiction quarter a few blocks over, and that you've never set foot in an entire Romance continent.

The problem is that Goodreads doesn't give you a genre. It gives you tags.

---

## The raw material: a folksonomy of 1,029 tags

Every book in the Goodreads dataset comes with a `genres` field that looks something like this:

```
["Fantasy", "Fiction", "Young Adult", "Magic", "Audiobook", "School", ...]
```

That's not a genre list. That's a **folksonomy** — an uncontrolled collection of terms applied by thousands of readers in different moods with different intentions. Across the full ~91K book index there are 1,029 distinct tags. A single book typically carries around ten.

The problem isn't the count. The problem is what's in there:
- **Real genres:** `Fantasy`, `Science Fiction`, `Mystery`, `Romance`
- **Sub-genres:** `Epic Fantasy`, `Urban Fantasy`, `Space Opera`, `Cozy Mystery`
- **Audience labels:** `Young Adult`, `Children`, `Middle Grade`
- **Formats:** `Audiobook`, `Graphic Novel` (when shelved as a format, not a genre)
- **Umbrella categories:** `Fiction`, `Nonfiction`, `Literature`
- **Cultural labels:** `Classics`, `Banned Books`
- **Topics masquerading as genres:** `War`, `Race`, `School`

And critically, Goodreads sorts these tags by shelving frequency — the number of readers who applied each tag — so "Fiction" often appears *before* "Fantasy" because more people tag broadly. If you just take the first tag, you'll label half your library "Fiction" or "Audiobook."

The coarse genre map I needed was not going to come from the data directly. I had to build it.

---

## The bucket map

The solution is a **priority-ordered bucket table** — 22 buckets, each with a set of Goodreads tags that map to it:

```python
GENRE_PRIORITY = [
    ("Fantasy",           {"Fantasy", "Urban Fantasy", "High Fantasy", "Epic Fantasy", "Paranormal", "Magic"}),
    ("Science Fiction",   {"Science Fiction", "Sci-Fi", "Dystopia", "Space Opera", "Apocalyptic"}),
    ("Horror",            {"Horror", "Gothic"}),
    ("Mystery",           {"Mystery", "Crime", "Detective", "Cozy Mystery", "Noir"}),
    ("Thriller",          {"Thriller", "Suspense", "Espionage"}),
    ("Romance",           {"Romance", "Contemporary Romance", "Historical Romance", "Chick Lit"}),
    ("Historical Fiction",{"Historical Fiction", "Historical"}),
    # ... 15 more buckets down to Travel and Food
]
```

The table only mentions **real content genres**. Format tags (`Audiobook`), umbrella categories (`Fiction`, `Nonfiction`), audience labels (`Young Adult`), and cultural status markers (`Classics`) appear nowhere in any bucket — not because I filter them out, but because I never include them. Any tag not listed in any bucket is silently ignored. This is the most important design decision in the whole system: **instead of trying to detect and skip the noise, I simply never listen to it.**

### The position-aware trick

A naive implementation of the bucket table would loop through buckets in priority order and return the first matching bucket. That fails immediately on a book tagged `["Fiction", "Fantasy", "Young Adult", "Epic Fantasy"]`: Fantasy does appear in the tags, but so might Science Fiction if this were a science fantasy novel. The question isn't which bucket appears first in my table — it's which of the book's own tags is the most community-endorsed one that maps to a real bucket.

The fix is to flip the loop:

> **Walk the book's tags in community-frequency order and return whichever bucket's matching tag appears earliest.**

Goodreads sorts tags by shelving frequency, so the first matching tag is the community's consensus answer. A book that 80,000 readers tagged "Science Fiction" and 20,000 tagged "Fantasy" will have "Science Fiction" appear earlier in its list, regardless of where either bucket sits in my table. The position in my table is only a tiebreaker within the same tag-position, never a hard override.

```python
def primary_genre(tags):
    best_pos, best_bucket = len(tags), "General/Other"
    for bucket, keys in GENRE_PRIORITY:
        for i, t in enumerate(tags):
            if t in keys and i < best_pos:
                best_pos, best_bucket = i, bucket
                break
    return best_bucket
```

### The Romance exception

There's one case where the position rule breaks down: **Historical Romance**.

A book tagged `["Historical Fiction", "Romance", "Historical Romance"]` has "Historical Fiction" appearing earlier than "Romance," and the position rule would label it Historical Fiction. But "Historical Romance" is a sub-genre of Romance, not of Historical Fiction — it's a romance novel set in a historical period, not a literary exploration of history. Readers looking for romance will want to find it; readers looking for historical fiction won't expect it.

The fix is an explicit override: if a book would be labeled Historical Fiction but carries *any* Romance keyword anywhere in its tags, it's re-labeled Romance.

```python
if best_bucket == "Historical Fiction" and set(tags) & ROMANCE_KEYS:
    return "Romance"
```

One rule, one line, handles every case. The test is simple to reason about and doesn't interact with the position logic.

### The meta-tags: Classics and General Fiction

Two tags conspicuously absent from the bucket table: `Classics` and `General Fiction`.

These are **cultural status tags**, not content genres. "Classics" tells you a book has canonical status; it tells you nothing about whether it's a novel, a poem, a play, or a philosophical treatise. "General Fiction" is a catch-all that means "literary or commercial fiction without a genre hook." A book tagged "Classics" might be sci-fi (*1984*), fantasy (*The Lord of the Rings*), horror (*Dracula*), history-adjacent literary fiction (*War and Peace*), or anything in between.

Putting these in a bucket would create a "Classics" genre that's meaningless — it would just grab every canonical work and remove it from its actual genre. Left out of all buckets, a book carrying only `["Classics", "Fiction"]` falls through to the fallback system, which assigns it a real genre based on what its content actually sounds like. That's the right answer.

---

## The fallback: 2,831 books with no genre

Even after all this, some books don't match any bucket. They carry only format tags, or audience labels, or genuinely obscure tags that I haven't mapped. In the 91K index, that was 2,831 books — about 3%.

The lazy answer is a catch-all "General/Other" bucket. The problem with that answer is that it's essentially useless: a map with a "General/Other" color swatch mixing every uncategorized book into one pile gives users no information.

The better answer: **let the embedding decide.**

The embeddings are already good at capturing semantic similarity — that's the whole point of the project. A book that "sounds like" five Thrillers but happens to have no Thriller tag is probably a Thriller. So for every book that matched no bucket, I find its nearest neighbor among the books that *did* match a bucket, and inherit that neighbor's genre:

```python
def resolve_other(embs, raw_genres, batch=1024):
    genres = raw_genres.copy()
    other_idx = np.where(genres == "General/Other")[0]
    known_idx = np.where(genres != "General/Other")[0]
    known_emb = embs[known_idx]
    for s in range(0, len(other_idx), batch):
        idx = other_idx[s:s + batch]
        nn = (embs[idx] @ known_emb.T).argmax(axis=1)
        genres[idx] = genres[known_idx[nn]]
    return genres
```

The embeddings are L2-normalized, so the dot product *is* cosine similarity — no further normalization needed. The whole 91K × 91K-ish comparison runs as batched matrix multiplications. After this step, no book in the index is labeled "General/Other." Zero.

The same logic applies at request time: books not in the index (misses) inherit the genre of their nearest corpus anchor. Since the corpus is itself fully genre-labeled, every user book — hit or miss — ends up with a real genre.

---

## Getting genres onto the user's books

The pipeline at request time is deliberately simple:

1. **Hits** (books matched to the index): genre is a free lookup in the index CSV. It was precomputed offline during the build step and stored as a plain column — the server does nothing more than read an array element.

2. **Misses** (books not in the index, requiring live embedding): genre comes from the nearest corpus anchor. After embedding the miss via OpenAI, one dot product against the 2,000 corpus embeddings finds the nearest anchor, and its precomputed genre is used. One multiplication, microseconds.

This is the offline/online split the whole architecture rests on. Genre computation is expensive (it requires all 91K embeddings and matrix operations over them). Do it once on the PC, write the result into the CSV that already ships to the server. The server never runs any genre logic heavier than an array lookup.

---

## Building the terrain

A colored scatter of 2,000 corpus dots tells you *where* each genre lives, but it doesn't convey *how much* of the map it occupies or how the edges between genres look. A Fantasy dot at one end of the map and a Fantasy dot at the other end don't tell you that Fantasy is a dense continent in the middle.

What I wanted was a **density-driven terrain** — a colored background that shows the actual distribution of each genre across the embedding space.

### The density field

The algorithm is straightforward:

1. For each of the 22 genres, take all the books in the 91K index that belong to it. Plot them onto an 800×800 pixel grid using their UMAP coordinates.
2. Apply a Gaussian blur (σ = 15 pixels) to turn the sparse point cloud into a smooth density field.
3. Stack all 22 density fields. At each pixel, the genre with the highest density value **wins** the color for that pixel.
4. The total density (sum of all genre densities) drives the alpha channel: empty space is transparent, dense cores are opaque.

```python
for g in genre_list:
    pts = index_2d[genre_labels == g]
    grid = np.zeros((GRID_SIZE, GRID_SIZE), dtype=np.float32)
    col, row = to_pixel(pts[:, 0], pts[:, 1])
    np.add.at(grid, (row, col), 1)
    density_maps[g] = scipy.ndimage.gaussian_filter(grid, sigma=SIGMA)

stacked = np.stack([density_maps[g] for g in genre_list], axis=0)
winner_idx = stacked.argmax(axis=0)  # which genre dominates each pixel
```

The result is a 135 KB PNG that paints the full literary landscape: a large pink Romance continent in one corner, a purple Fantasy bloc next to it, a cluster of blue Science Fiction, smaller islands of Mystery and Historical Fiction, and sparse outposts of Poetry, Food, and Travel at the edges.

### PNG to SVG: the zoom problem

The PNG works as a background image, but zoom in and it pixelates. For an interactive map where users pan and zoom, this matters.

The fix is to trace the density field into vector paths instead of rasterizing it. The approach:

1. Build the same 800×800 density grid as before.
2. For each genre, extract the region where it's the winner (a binary mask).
3. Smooth the mask slightly (σ = 1 pixel — just enough to round the staircased raster edges).
4. Trace the contour of that region using `contourpy` (the library underlying matplotlib's contour plots).
5. Emit each contour polygon as an SVG `<path>` element with the genre's fill color.

The result is an SVG with 62 polygons and a weight of 258 KB. Browsers re-rasterize SVG at the displayed resolution, so edges stay crisp at any zoom level. The Plotly frontend pins it to the coordinate system the same way as the PNG — four numbers specifying the data-space extents of the image.

One implementation detail worth noting: SVG's y-axis points downward while data coordinates point upward. The fix is a `scale(1,-1)` transform on the polygon group with a compensating translation, so coordinates can be emitted in data space directly without any row-flipping.

---

## The reference map: what the literary world actually looks like

The 2K anchor corpus was originally selected by **k-means++ diversity sampling** — the algorithm that picks the most spread-out points across the embedding space. That's the right choice for the corpus's primary job (giving every user book something nearby to project against). But it's the *wrong* background for genre terrain.

K-means++ diversity sampling deliberately suppresses clustering. It actively seeks points that are far from each other. The result is a corpus with almost no visible density variation — a near-uniform fog with 22 colors sprinkled evenly across it. It's great at covering the space; it's terrible at showing users what the space actually *contains*.

What a background should show is the **true distribution** of literature. If Romance makes up 25.5% of the 91K index, it should visually dominate the background. If Poetry is 1.5%, it should be a small feature. The map should look like the literary world, not a mathematical proof that the embedding space is evenly covered.

So I built a second corpus: **distribution-proportional sampling**. Each genre's allocation is proportional to its share of the 91K index, with a floor of 5 books per genre so tiny categories don't disappear entirely:

| Genre | Index share | Corpus slots |
|---|---|---|
| Romance | 25.5% | 488 |
| Fantasy | 16.5% | 318 |
| Mystery | 12.2% | 235 |
| Historical Fiction | 5.9% | 117 |
| Comics/Graphic | 5.6% | 110 |
| Science Fiction | 5.2% | 103 |
| Biography/Memoir | 4.2% | 84 |
| ... | ... | ... |
| Travel | 0.7% | 18 |

Within each genre, books are sampled randomly — preserving the within-genre spatial distribution rather than smoothing it out (that's what the density field blur is for). The total is still 2,000 books.

This corpus is the **reference map** — the answer to "what does the map of books look like?" It shows users that Romance and Fantasy are the two dominant continents, Mystery is a major city, and Poetry is a small island. When a user sees where their own books land relative to this background, they're seeing their taste plotted against the actual shape of popular literature, not against a mathematical abstraction.

---

## Picking 22 colors that actually look different

With 22 genre categories, off-the-shelf categorical palettes run out of steam. Plotly's `Alphabet` palette (26 colors) works in principle, but the assignment order matters: semantically related genres like Fantasy and Science Fiction should probably not share similar-looking colors, and there's no reason the arbitrary alphabetical ordering of genres should produce good color adjacency.

The better approach is to build the palette explicitly using **perceptual color science**. The `glasbey` library does this by greedily selecting colors that are maximally far apart in **CAM02-UCS perceptual color space** — a color model that approximates how humans actually perceive differences between colors, not how different the RGB coordinates are.

```python
import glasbey
hex_colors = glasbey.create_palette(
    palette_size=22,
    lightness_bounds=(28, 58),   # darker tones — vivid without being garish
    chroma_bounds=(55, 85),      # saturated enough to read on a white background
)
```

The bounds keep colors dark enough to be legible against the white map background and saturated enough to be visually distinct, avoiding the washed-out pastels and near-blacks that appear when you let the optimizer roam unconstrained.

The output is a list of hex codes that gets manually mapped to genre names in a deliberate order — so Fantasy gets a distinct purple, Romance gets pink, Mystery gets magenta, and the colors are the same between the terrain background, the corpus scatter, the user's own books, and the recommendation overlays. One palette, used everywhere, so the visual language is consistent across every view.

---

## The whole thing as a data flow

Pulling it together:

```
OFFLINE (PC, one-time):
  91K index CSV  →  parse genres column (1,029 raw tags)
                 →  primary_genre() — position-aware bucket lookup
                 →  resolve_other() — nearest-neighbor relabeling for ~3% fallback
                 →  write "primary_genre" column into index CSV

  index_2d.npy   +  primary_genre column
                 →  per-genre 800×800 density grid + Gaussian blur
                 →  winner-take-all → SVG polygon trace → genre_terrain.svg

  distribution-proportional 2K sample → Corpus-2K.csv

SHIP TO SERVER:
  Goodreads-Final-90k.csv  (now has primary_genre column)
  Corpus-2K.csv            (distribution-proportional, with genre)
  genre_terrain.svg        (the background image)
  genre_terrain_bounds.json (coordinate extents for pinning)

AT REQUEST TIME (server):
  Hit book  → read genre from index CSV row (free array lookup)
  Miss book → embed via API → dot product against corpus → inherit nearest anchor's genre
```

No genre computation happens on the server. No bucket table, no resolver, no embedding math in the hot path. The server reads a column.

---

## What I'd tell myself earlier

The genre system taught me a cleaner version of the same lesson that ran through the whole project: **the hard part isn't the algorithm, it's the data.**

The position-aware logic is two extra lines in the bucket-lookup loop. The Romance exception is one more line after it. The neighbor fallback is a batched matrix multiply. None of these are algorithmically complex. The work was understanding the data well enough to know *why* the naive approach fails — that Goodreads sorts tags by popularity so "Fiction" precedes "Fantasy," that "Historical Romance" is a romance sub-genre and not a historical novel, that "Classics" is a status label and not a content category.

The terrain visualization taught a different lesson: **always check what you're actually showing.** The diversity-sampled corpus looked reasonable — 2,000 colored dots spread across the map — until I compared it to the distribution-proportional version. The diversity corpus shows the shape of the embedding *space*; the distribution corpus shows the shape of *literature*. They're different things, and which one you want as a background matters.

The first time I ran the distribution corpus and saw a pink Romance continent taking up a quarter of the map, it was one of those "oh, right" moments. That *is* what the literary world looks like. The map was finally showing something true.
