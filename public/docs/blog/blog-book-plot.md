---
title: "Mapping my bookshelf: building Book Plot"
date: 2026-06-09
description: How I turned my Goodreads export into a self-hosted, interactive map of my reading taste — embeddings, UMAP, recommendations, and all the parts that didn't work the first time.
tags: [Machine Learning, Embeddings, UMAP, Self-hosted]
---

# Mapping my bookshelf: building Book Plot

_2026-06-09_

<div class="article-banner"><img src="/images/blog-book-plot.webp" alt="Book Plot — an interactive star-map of a reading history" style="height:auto"/></div>

I enjoy reading, and at some point I started wondering what all the books I've read would look like if you plotted them on a map of the entire literary world. At the same time, I'm always looking for my next great read.

So I built BookPlot to find out.

BookPlot takes my Goodreads export and transforms it into an interactive 2D map where books that are conceptually similar naturally cluster together—fantasy epics in one corner, philosophy in another, pop science somewhere in between. Once the map is built, it highlights unread books near the ones I loved and quietly suggests: you'll probably enjoy these too.

Most of it self-hosted on an old laptop sitting in my house, and building it led me down a surprising number of rabbit holes involving embeddings, recommendation systems, data visualization, and homelab infrastructure.

This is the story of how it actually got built — including all the parts that didn't work the first time.

---

## The naive first version (and why it wasn't enough)

The first version was almost embarrassingly simple, and that was the point — I wanted to prove the idea end-to-end before committing to anything.

The pipeline:

1. Filter the Goodreads CSV to the `read` shelf.
2. Turn each book into the string `"Title by Author"`.
3. Embed each string with `all-MiniLM-L6-v2` — a tiny 22M-parameter sentence-transformer that maps text into a 384-dimensional vector where "similar meaning" means "similar direction."
4. Run **UMAP** to crush those 384 dimensions down to an (x, y) coordinate.
5. Draw it with Plotly, with hover tooltips and dots sized by my rating.

There's a subtle trick hiding in step 3–4: if you only feed UMAP your own ~60 books, the map is garbage. UMAP learns the *shape* of a dataset, and 60 points have no shape. So I added a hand-curated **corpus of 455 well-known books** across 17 genres as anchor points. Think of it like laying down streets and landmarks before you drop your own buildings on the map — now "close" actually means something.

It worked! I had a map. And it was… fine. The clusters were real but coarse. The recommendations were *obvious* — "you liked fantasy, here's more fantasy." The problem was baked into step 2: the model only ever saw four-to-six words per book. From `"Dune by Frank Herbert"` it can tell sci-fi from romance, but it cannot tell hard sci-fi from space opera, or distinguish a book's actual *themes*. It was reading the title and guessing.

That realization is the hinge the whole project turns on:

> **The text you embed matters more than the model you embed it with.** A plot blurb beats a bigger neural network.

Everything after this was me chasing that one insight.

---

## The pivot: descriptions, an API, and a much bigger haystack

If descriptions are the lever, I needed two things I didn't have: **book descriptions** and **a lot more books** to recommend from (455 hand-picked titles is a cute demo, not a recommendation engine).

So the architecture pivoted:

- **Embeddings move to a hosted API** (OpenAI's `text-embedding-3-small` at 512 dimensions). The text becomes `title by author. description`. I'm no longer embedding on the weak server CPU — it's a couple of cents for the whole catalog and a fraction of a cent per user request.
- **A real dataset.** I sourced the BrightData Goodreads export — which turned out to be **6.4 million rows and ~8.3 GB**, considerably chunkier than the 3.8M I'd budgeted for.
- **A clean split of labor.** All the heavy one-time work (cleaning, embedding the catalog, fitting the layout) happens *offline* on my PC. The home server only ever loads the finished `.npy` files and does cheap lookups. The server's job shrank to almost nothing, which is exactly what you want from a 2015 laptop.

Simple on paper. Then I opened the 8.3 GB file.

---

## Wrangling 6.4M books down to 91K

This was the longest, least glamorous, most educational part of the project. A few things I learned the hard way:

**You can't just read the file.** 8.3 GB doesn't fit in the server's 5.7 GB of RAM, and even on my PC, loading it naively is painful. Everything had to stream in chunks.

**You can't split it by lines, either.** Book summaries contain embedded newlines inside quoted CSV fields. Any line-based tool — `head`, naive chunking — silently corrupts rows by splitting a record mid-summary. Only a CSV-*aware* reader (`pandas` with `chunksize`) is safe. This one cost me an afternoon of "why is this row garbage."

**Half the columns are JSON strings.** `author` and `genres` come in as stringified arrays (`["Frank Herbert"]`); other fields are stringified objects. `num_reviews` is text with commas (`"1,234"`); `kindle_price` is `"$10.89"`. The only clean, always-present signal is `num_ratings`.

The cleaning pipeline that emerged (6.39M → ~91K):

1. **Popularity floor** (`num_ratings ≥ 1451`). This was a genuine decision, not a magic number. A rating threshold is a *blunt instrument* — a low rating count means a book is *obscure*, not *bad*. Its real jobs are statistical reliability (a 5.0 from 9 ratings is noise) and hitting my ~100K memory target. I picked the value by working backwards from the target size and spot-checking quality bands.
2. **Completeness gate** — require both a summary (the embedding-quality lever) and genres. Conveniently, `genres` is only ~27% populated overall but ~90% populated *once you've applied the popularity floor*. Order matters.
3. **Dedup** editions down to one row per *work* (normalized title + primary author, keep the most-rated edition).
4. **Format filtering** — regex out box sets, omnibuses, posters, sheet music, "Books 1-3" bundles, annuals. These often have *high* ratings, so no quality score will catch them; they're category errors that need targeted removal. (Careful-word handling here: I only match `anniversary` when it has a leading number, so it can't nuke a legitimately-titled book.)
5. **No quality floor** — the most counter-intuitive call I made. I expected to delete the bottom of the rating distribution. But when I actually *looked* at the bottom, it wasn't bad books — it was forced-reading canon (resentful students one-starring Mickiewicz), major literary figures, and divisive bestsellers. Deleting it would erase canon for negligible gain. The rule I now follow: only cut a tail if it's visible, *and* spot-checking confirms it's genuinely low-quality, *and* the count is small. This failed the middle test.
6. **Language filter** — English-only, but detected on the *summary*, not the title. The question isn't "is this an English book," it's "is the blurb English text the model can embed sensibly." A translated classic with an English summary stays; a Polish-summary book embeds to a misleading position and goes.

The lesson that kept repeating: **look at your data before you trust a heuristic about it.** Almost every rule I almost-applied turned out to be subtly wrong until I eyeballed the actual rows.

---

## Choosing the 2,000 anchors

The 91K is the *recommendation pool*. But UMAP can't lay out 91K points per request — I needed a smaller **anchor corpus** (~2K) that defines the map's coordinate system, with the user's books projected into it.

The goal of the corpus is *even coverage of the embedding space* — so a user's book always has something nearby to anchor to. I weighed two approaches:

- **Option 2: genre buckets.** Map the messy tags into ~15 clean genres, allocate evenly, sample within each. Guaranteed coverage, but it depends on a tag→bucket mapping I'd have to build and maintain — and the genre data is a *folksonomy*, not a taxonomy: 1,029 distinct tags, ~10 per book, mixing formats (`Audiobook`), umbrellas (`Fiction`), and audience (`Young Adult`) in with actual genres.
- **Option 1: pure embedding diversity.** Use k-means++ to pick the 2K most spread-out points directly in embedding space. It optimizes the *real* objective (space coverage) instead of a proxy (genre tags).

I went with Option 1, with a coarse genre map built only as a *coverage check* — a safety net to confirm pure diversity sampling didn't starve any genre. It didn't: all 25 coarse genres came out covered, representation ratios near 1.0. The simple option won, and the genre scaffold I'd have needed for Option 2 became unnecessary. (That coarse genre map came back to be useful later — see the coloring section.)

---

## The map: why UMAP, and fit-once vs fit-every-time

A quick aside on why **UMAP** and not t-SNE or PCA, since I get asked this:

- **PCA** is linear; semantic similarity isn't. Muddy clusters.
- **t-SNE** makes pretty local clusters but throws away *global* structure — two unrelated genres can land next to each other by accident. It also has no `transform` method, which (foreshadowing) matters a lot for a server.
- **UMAP** preserves both local clusters *and* global relationships, and it's faster.

The architecture decision that mattered most: **fit the UMAP reducer once on the fixed 2K corpus at startup, then `transform` each user's books into that frozen space per request.** The alternative — re-running `fit_transform` on corpus+user every time — re-lays-out the anchors on every request and gives every user a different, incomparable coordinate system. Fitting once means the map is stable, every user shares the same geography, and the per-request cost drops to projecting ~50 points into an existing space. (This is also exactly why t-SNE was a non-starter for the server: no `transform`, so you'd be forced into the slow, incomparable mode.)

---

## Rabbit hole #1: getting a summary for *your* books

Here's a problem I didn't see coming. The catalog is embedded with rich `title by author. summary` text. But **a Goodreads export has no summaries** — just title, author, and an ISBN. If I embed the user's books title-only, they're not comparable to the summary-rich catalog, and the whole "descriptions are the lever" insight evaporates for exactly the books I care about most.

The fix is a two-part strategy:

**Match-and-reuse first.** If a book you've read is already in the 91K catalog (matched on normalized title + author), I just **reuse its existing embedding** — free, summary-rich, identical model. On a typical shelf, ~77–83% of books are hits. Only the misses need real work.

**Enrich the misses by fetching a real blurb.** This is where it got finicky:

- **ISBNs are brittle.** Goodreads stores the edition *you* logged, which is often a different edition than the providers indexed — or blank entirely for Kindle. So `isbn:` lookups whiff even for famous books.
- **Open Library is patchy and title-matching is a minefield.** Searches got defeated by, in order: the **series parenthetical** (`(The Poppy War, #1)`), the **subtitle** (`Ikigai: The Japanese Secret…` returned nothing; bare `Ikigai` returned the right book), **`&` vs `and`** being different records, and **omnibus bundles** with no blurb. The fix is a pile of small surgeries: strip parens and subtitles, try both `&`/`and` spellings, skip `/`-titled bundles, and prefer the result whose author actually matches.
- **Google Books as a fallback** catches recent indie titles OL misses — but only via title search, and its anonymous quota is a *shared* pool that starts returning 429s after a handful of calls. A free API key gives you a private 1,000/day with no billing risk (overage just 429s, never charges).

The working **ladder**, per book: reuse-from-index → OL by ISBN → OL title search (cleaned up as above) → Google Books by ISBN → Google Books title search. Blurbs cache to disk so each book is ever fetched once, and the lookups run in a thread pool so a shelf's worth of misses resolves in seconds instead of a minute.

---

## Rabbit hole #2: the recommender kept recommending books I'd already read

Cosine similarity against 91K books surfaced great matches. It also surfaced a parade of "you'd love this book… that you have literally already read." Each leak needed its own fix:

- **Author spelling drift.** My export said `"Frank Patrick Herbert"`; the catalog said `"Frank Herbert"`. The mismatch broke the match, so **Dune got recommended to me** and wasn't recognized as same-author. Fix: an `author_key` that reduces every name to **first + last**, applied to both sides. Consistency beats correctness — surname particles collapse the same way on both sides, so matching still works.
- **One author, many books.** Recommendations stacked five titles by the same author. Fix: walk the ranking, keep at most one book per author.
- **Relatives and continuations.** Brian Herbert (Frank's son, Dune continuations) showed up as a "new" author. Fix: treat an author as *familiar* if they merely **share a surname** with someone you've read, and split the recommendations into **New authors** vs **Familiar authors** so continuations don't masquerade as discovery.
- **Adaptations and study guides.** A graded-reader "1984" by a different "author," and *Fahrenheit 451: The Authorized Adaptation*, are the *same work* by an adapter — they dodge the title+author key and score near-perfect cosine. Fix: also exclude by **title**, with a twist — exact-title match always, plus title-*containment* only for multi-word titles. That way `Fahrenheit 451` removes its adaptations, while single-word `1984` stays exact-only so *The Class of 1984* isn't wrongly nuked.

There's a known limit I left in honestly: title alone can't simultaneously drop a subtitled single-word reader and keep a different book that merely contains that word. The real fix would be upstream (keep adaptations out of the catalog entirely), and I noted it rather than over-engineering around it.

I also tested the whole thing against a friend's library, not just mine — a good reality check that the heuristics weren't secretly overfit to my own shelf.

---

## Coloring the map by genre

Most recently I wanted the map *colored by genre* — each book tinted by what it is, with the corpus shown faintly behind as the genre "terrain". I quite liked the visualizations of this new plot but I still have some more work to do before I release it. This one as opposed to the book universe where you can mainly see how close each of the books you have read is to each other, provides also the colored genres which I find quite intresting. 

The coarse genre map I'd built earlier (as a coverage check) paid off here: collapse the 1,029-tag folksonomy into ~24 clean buckets via a priority-ordered rule (specific genres win over generic umbrellas; formats and audience tags are simply ignored). Hits get their genre for free from the matched catalog row; misses inherit the genre of their nearest corpus anchor.

One nice constraint I added: **no book is allowed to be labeled "General/Other."** Anything that matches no bucket gets relabeled with the genre of its nearest neighbor in embedding space. If the tags can't tell me what a book is, its neighbors can.

---

## Putting it on a server

The notebook validated everything. Turning it into a service had its own set of decisions:

- **FastAPI in a Docker container**, behind the Nginx already running on the home server. Docker mostly so I could pin Python 3.12 and stop caring what the server's system Python is.
- **A hard split between offline and online.** Artifacts (the 190 MB embeddings, the corpus ids, the caches) are `rsync`'d to a bind-mount volume on the server — never baked into the image. The container loads them once at startup (~5–10s, during which health reports `reducer_ready: false`), then every request is cheap.
- **A timeout budget on enrichment.** The blurb ladder is wrapped in an ~8-second overall deadline running in a thread pool. Whatever blurbs arrive in time are used; the rest fall back to title-only *for that request* but still get fetched lazily and cached, so they're hits next time. This bounds worst-case latency no matter how slow Open Library is feeling.
- **A single worker, on purpose.** It's a personal, low-traffic site on a 2015 laptop. Requests serialize; Nginx's 120s timeout covers the occasional wait. Adding workers would just multiply the memory footprint for no real benefit.
- **The API returns raw structured data**, not a pre-built Plotly figure — so the frontend owns rendering and isn't coupled to my plotting choices.

---

## What I'd tell myself at the start

- **The input text beats the model.** I spent the first version optimizing the wrong thing. The single biggest quality jump came from feeding the embedder descriptions, not from a fancier network.
- **Look at the data before trusting a rule about it.** Nearly every cleaning heuristic I almost shipped was subtly wrong until I read the actual rows — the "bad" tail that was really canon, the newlines that corrupted my chunks, the ISBNs that pointed at the wrong edition.
- **Real-world matching is a thousand small surgeries.** Author spelling, series parentheticals, subtitles, `&` vs `and`, adaptations — none of it is hard individually, but the long tail of edge cases *is* the work.
- **Decide where the heavy work lives.** Pushing all the expensive computation offline turned an underpowered home server into a perfectly adequate one. The constraint clarified the architecture.

The map is genuinely fun to look at now — and the first time it pointed me at a book I'd never heard of, in a corner of the map I didn't know I had, I knew the rabbit holes had been worth it.
