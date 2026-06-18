# João Jorge — Personal Site

A personal portfolio and blog built as a single-page React app whose entire
content lives in plain Markdown files. Add a `.md` file, register it in the
manifest, and a new page appears — no CMS, no database, no build step to author.

## Why it was built

I wanted a personal site (about, projects, blog, contact) that I could maintain
the way I write notes: by editing Markdown. Most portfolio templates force you to
either hand-write JSX for every page or run a heavyweight static-site generator.
This project keeps the authoring experience as simple as dropping a Markdown file
into a folder, while still rendering as a fast, modern React app.

It also doubles as a home for **Book Plot** — an interactive project that turns a
Goodreads export into a "star-map" of your reading taste and suggests what to read
next.

## How it works

### Content is just Markdown

- All pages live under `public/docs/` as `.md` files (e.g. `about.md`,
  `blog/blog-hello-world.md`).
- The site fetches these files at runtime and renders them with `react-markdown`,
  supporting GitHub-flavored Markdown, YAML frontmatter, and raw HTML/embedded
  `<style>` blocks (used for things like the animated home hero).
- Navigation is driven by `public/docs/manifest.json`, a tree of
  `{ slug, title, children }` entries that builds the collapsible sidebar.
- Internal links written as `[text](page.md)` are intercepted and routed
  client-side, so cross-linking pages feels native.

### Index pages generate themselves

- The blog and projects listing pages use a custom `<cardlist>` Markdown tag that
  renders a grid of cards from a JSON index.
- Those `index.json` files are produced by `scripts/generate-indexes.js`, which
  scans a folder, reads each file's frontmatter (title, date, description, tags,
  image, highlight) and writes a sorted index.
- A small Vite plugin runs this script on `buildStart` and re-runs it whenever a
  Markdown file or image changes during `vite dev` — so listings stay in sync
  automatically.
- If a card has no explicit image, the generator auto-matches an image in
  `public/images/` by filename.

### Routing & rendering

- `HashRouter` (from React Router) handles routing so the app works on static
  hosts with no server-side rewrite rules.
- Markdown and JSON responses are cached in memory after first fetch, and the blog
  and project indexes are prefetched on load for snappy navigation.

### Book Plot

A standalone feature at `/book-plot`:

- You drop in your Goodreads CSV export. It's sent to a backend recommender
  (`/api/books/*`) that embeds and dimensionally-reduces your library, then
  returns coordinates, genres, and recommendations.
- The result is drawn as an animated canvas "star-map" where each book is a star
  colored by genre, with a faded reference corpus behind small libraries and
  recommendations highlighted as dimmer stars to follow.
- In development (`import.meta.env.DEV`) the backend is mocked with sample data
  (`src/bookGraphSample.js`), so the UI runs fully offline.
- Nothing is stored — the uploaded CSV is processed once to draw the map.

### Images

`npm run compress-images` uses `sharp` to compress and convert source images
(e.g. to WebP) for the `public/images/` folder.

## Technologies used

- **React 19** — UI, built with function components and hooks.
- **Vite 8** — dev server, HMR, and production bundling (with manual vendor/markdown
  chunk splitting).
- **React Router 7** (`HashRouter`) — client-side routing for static hosting.
- **react-markdown** with **remark-gfm**, **remark-frontmatter**, and **rehype-raw**
  — Markdown rendering with GFM, frontmatter, and inline HTML support.
- **HTML Canvas** — the Book Plot star-map visualization.
- **sharp** — image compression tooling.
- **ESLint** — linting (React Hooks + React Refresh plugins).
- Plain **CSS** for styling and theming.

## Project structure

```
public/
  docs/              Markdown content + manifest.json (the whole site's content)
    blog/            blog posts + auto-generated index.json
    projects/        project write-ups
    about/           about sub-pages
  images/            images referenced by pages and cards
scripts/
  generate-indexes.js  builds index.json files from frontmatter
  compress-images.js   image compression via sharp
src/
  App.jsx            layout, sidebar, routing, Markdown rendering, card grids
  BookGraph.jsx      Book Plot feature entry point
  bookGraph/         star-map, dropzone, recommendations, API client
vite.config.js       Vite config + index-generation plugin
```

## Getting started

```bash
npm install      # install dependencies
npm run dev      # start the dev server (Book Plot uses mock data here)
npm run build    # production build to dist/
npm run preview  # preview the production build
npm run lint     # run ESLint
```

### Adding a page

1. Create `public/docs/your-page.md` (optionally with frontmatter).
2. Add an entry to `public/docs/manifest.json` so it appears in the sidebar.
3. For a blog post or project, just drop the `.md` in `blog/` or `projects/` — the
   index regenerates automatically and a card appears in the listing.
