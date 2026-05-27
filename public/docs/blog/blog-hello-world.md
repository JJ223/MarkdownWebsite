---
title: Hello World — Why I built this
date: 2026-05-27
description: The story behind this site — why I built it, how the content pipeline works, and where it's going next.
---

# Hello World — Why I built this

_2026-05-27_

---

I wanted a personal website that felt like a notebook rather than a portfolio template. Something I could write in plaintext, navigate like a wiki, and publish without thinking about CMS dashboards or build pipelines. This site is that experiment.

## The stack

The site is a Vite + React single-page app. Every page is a `.md` file fetched at runtime and rendered with `react-markdown`. There is no database, no server-side rendering, no framework magic — just a JSON manifest that drives the sidebar and a fetch call per page load.

The URL structure mirrors the file structure. `#/about/education` fetches `public/docs/about/education.md`. Adding a page means dropping a file and registering it in the manifest. Removing one means deleting the file.

## How the blog (and project cards) work

The most interesting part of the setup is how new posts and projects appear automatically as cards without any code changes.

Every post and project file starts with a YAML frontmatter block:

```yaml
---
title: Hello World — Why I built this
date: 2026-05-27
description: The story behind this site.
---
```

At build time — and during development whenever a `.md` file changes — a small Node script (`scripts/generate-indexes.js`) scans specific folders and produces an `index.json` file for each one:

- `public/docs/blog/index.json` — all blog posts
- `public/docs/projects/work-projects/index.json` — work projects
- `public/docs/projects/my-projects/index.json` — personal projects

Each JSON entry contains the slug, title, date, description, tags, and org pulled from frontmatter. Entries are sorted by date, newest first. Undated entries appear at the bottom.

The Vite plugin wires this into the dev server:

```js
configureServer(server) {
  server.watcher.on('add',    (f) => { if (f.endsWith('.md')) run() })
  server.watcher.on('unlink', (f) => { if (f.endsWith('.md')) run() })
  server.watcher.on('change', (f) => { if (f.endsWith('.md')) run() })
}
```

On the React side, the `blog.md` page contains a single custom tag:

```html
<cardlist src="blog/index.json"></cardlist>
```

`react-markdown` maps this to a `CardIndex` component, which fetches the JSON and renders the card grid. Adding a new post to the blog is just dropping a `.md` file with frontmatter into `public/docs/blog/` — the index regenerates, the card appears, no other changes needed.

## The hosting plan

Right now the markdown files live inside the git repository alongside the React source code. That means every new post triggers a full redeploy. For a blog that changes more often than the app itself, that coupling is unnecessary overhead.

The plan is to host the `public/docs/` folder separately — on a CDN or an object storage bucket — and configure the app to fetch content from that external URL instead of its own origin. The React app becomes a static shell that never changes between posts. Writing a new entry means uploading a `.md` file and running the index generator against the remote bucket. No git commit, no build, no deploy.

This separation also makes the content easier to edit from anywhere: a text editor, a mobile app, or a simple upload form — without ever touching the codebase.

---

[← Back to Blog](blog.md) · [Archive](blog/archive.md)
