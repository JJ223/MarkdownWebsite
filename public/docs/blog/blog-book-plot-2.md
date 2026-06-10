---
title: "Book Plot, part two: surviving 4,000-book libraries"
date: 2026-06-10
description: BookPlot worked beautifully on my ~70 books and timed out on everyone else's. The fix meant rethinking the whole map — building it once on a 90K-book catalog instead of projecting onto a tiny corpus per request.
tags: [Machine Learning, UMAP, Performance, Self-hosted]
---

# Book Plot, part two: surviving 4,000-book libraries

_2026-06-10_

<div class="article-banner"><img src="/images/blog-book-plot-2.webp" alt="Book Plot — an interactive star-map of a reading history" style="height:auto"/></div>

In the [first post](blog/blog-book-plot.md) I walked through how I built BookPlot — a self-hosted, interactive map of my reading taste, with recommendations layered on top. It worked, I was happy with it, and I shared it.

Then most of the people who tested it ran into the same wall: **504 Gateway Timeout**.

---

## I never stressed my own application

I hadn't accounted for just how much some people love books. My own Goodreads library has around **70 books**, so I never came close to stressing the application — every request I made resolved instantly.

The reading enthusiasts who tried it were a different species. They were uploading libraries with **4,000+ books**, and the server folded every time.

A nice, humbling reminder that performance problems often don't show up until real users bring data that's nothing like your own.

After digging in, I found two main bottlenecks.

---

## Bottleneck #1: matching logic doing far too much work

The first was the title-matching logic — the code that decides, for each candidate recommendation, whether you've effectively already read it (an adaptation, a study guide, a same-series omnibus).

It worked correctly, but it was doing far more work than necessary. The containment checks were recompiling a regex and scanning it against the roughly **90,000 books** in the catalog *on every request*. At 70 books you never notice. At 4,000 read books crossed against 90K candidates, it's the difference between a snappy response and a timeout.

The fix was to stop scanning and start looking up. Titles are normalised once to single-spaced `[a-z0-9]` tokens, and exclusions become **set and index lookups** instead of per-row regex:

- A precomputed `phrase_to_rows` index (built once at startup) maps every catalog title's sub-phrases to the rows they appear in, so forward containment is a union over *your* titles — O(read), not O(90K).
- Reverse containment enumerates your read titles' ≥3-word sub-phrases into a set and does one vectorised `isin`.

Same answers, a tiny fraction of the work.

---

## Bottleneck #2: the map was built the wrong way round

The second bottleneck was more fundamental — it was baked into the architecture itself.

Originally I ran UMAP on a small **2,000-book anchor corpus**, fit the reducer once, and then called `UMAP.transform()` to project every other book onto that frozen space at request time. That transform was the slow part: roughly **24 seconds for 4,000 books**, and *the* direct cause of the timeouts.

But the deeper problem was that it didn't even make sense anymore. I was projecting onto a 2,000-book scaffold when I already had a **90,000-book catalog** sitting right there. If I was going to build a map, I might as well build it from the full dataset — a better landscape *and* the recommendation pool, in one.

So I flipped it. Instead of fitting on a tiny corpus and transforming per request, I build the entire map offline, once, on all 90K books — and at request time I never run UMAP at all.

### The new pipeline

**OFFLINE — build once, ship the artifacts**

- Embed the ~90K book catalog (OpenAI `text-embedding-3-small`, 512-dim).
- Reduce dimensions with **PCA — 271 dimensions, 90% of variance retained**.
- Run **UMAP on the entire catalog**.
- Store the resulting 90K book coordinates (`index_2d.npy`, a ~0.7 MB file the server loads at startup).

**ONLINE — per request**

- Parse the Goodreads export.
- For books already in the catalog, **look up their coordinates directly** — a dictionary lookup, not a transform.
- For books *not* in the catalog, fetch metadata, generate embeddings, and place them with **k-nearest-neighbour interpolation** (a book lands at the weighted average of its 5 nearest catalog books' coordinates).
- Run the recommendation search against the 90K-book index.
- Return the map and recommendations as JSON.

### Why PCA first

Running UMAP directly on 90K × 512 is slow and memory-hungry on the target hardware — an old i5 laptop with about 5 GB of RAM. PCA does the cheap bulk reduction first: 512 → 271 dimensions while keeping 90% of the variance. It's linear, so it throws away only low-variance noise and leaves the structure UMAP actually needs. That brought the offline fit down to ~40 seconds and kept it inside the memory budget. UMAP then does the non-linear work that genuinely separates genres.

Because the map is precomputed, **most user books are now simple coordinate lookups**. The handful that aren't are placed with kNN, which is extremely fast — one chunked matrix multiply plus a small gather, no model, no UMAP, no FAISS. I validated that this kNN placement tracks a true `UMAP.transform` closely (positions shift by only ~0.06 of the layout's spread, with no extra clumping) while being hundreds of times faster.

---

## The result

Libraries that previously took minutes to process — or timed out completely — now typically resolve in **under 10 seconds**. The expensive UMAP fit happens exactly once, offline, and the per-request work shrinks to lookups and a little matrix multiplication.

There's a quiet side benefit, too: because hits resolve to *exact* coordinates instead of being blurred onto a 2K scaffold, the positions are genuinely more accurate. Same-series books can now land on the same pixel — which is correct, and which I handle at the rendering layer with marker opacity and a touch of jitter rather than by degrading the coordinates.

---

## What's next

I'm also working on a **genre-coloured version of the map** — each book tinted by what it is, with the catalog shown faintly behind as the genre "terrain." It's already looking pretty good, and I'll write about it once it's ready to release.

The broader lesson stuck with me: the slowest part of a system is rarely where you'd guess from your own usage. It took someone else's 4,000 books to show me that the map was built the wrong way round all along.
