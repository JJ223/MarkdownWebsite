# Getting Started

## Adding a new page

1. Create a new `.md` file inside `public/docs/`, e.g. `public/docs/my-page.md`
2. Open `public/docs/manifest.json` and add an entry:

```json
{ "slug": "my-page", "title": "My Page" }
```

The **slug** must match the filename without the `.md` extension.
The **title** is what appears in the sidebar.

## Linking between pages

Use ordinary Markdown links with a `.md` extension — they are automatically
converted to in-app navigation:

```md
[Go to About](./about.md)
[Back to Home](./index.md)
```

External links open in a new tab as normal.

## Page not found

If you navigate to a slug that has no matching file, the app shows a friendly
404 message. Just add the file and register it in the manifest.

---

[Back to Home](./index.md) · [About](./about.md)
