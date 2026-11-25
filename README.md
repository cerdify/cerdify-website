# cerdify.com

The public website for Cerdify. Static HTML and CSS: no JavaScript, forms, cookies, analytics or third-party requests.

- Sign in goes to https://app.cerdify.com/
- Fonts: IBM Plex, self-hosted, SIL Open Font License (fonts/OFL.txt)
- Hosted with GitHub Pages from `main`; custom domain in CNAME. Merging to `main` publishes the site.

## How the site is built

Pages are written in `_src/` and generated into the repository root by a small Node script with no dependencies. GitHub Pages skips folders that start with `_`, so `_src/` is never published. The generated files are committed.

| Source | What it is |
| --- | --- |
| `_src/pages/` | One file per page. A JSON block at the top sets the title, description, breadcrumbs and structured data; the rest is the page body. `pages/resources/x.html` becomes `/resources/x`. |
| `_src/partials/` | The shared header, footer and the logo mark (`mark.svg`). |
| `_src/site.css` | The shared styles and colour tokens, inlined into every page. |
| `_src/site.json` | Site settings: legal name, contact, the beta-request email, the preview image and search-engine verification codes. |
| `_src/og.html` | Source of the 1200 × 630 link-preview image. |

```
node _src/build.mjs            # write the pages, sitemap.xml and robots.txt
node _src/build.mjs --check    # CI: fail if a generated file is out of date
node _src/serve.mjs            # preview at http://localhost:8787 with GitHub Pages-style URLs
node _src/render-assets.mjs    # with serve.mjs running: re-render the preview image, logo PNG and checklist PDF
```

The build refuses a page without a title or description, or with the same title or description as another page.

Every page gets: a canonical URL, Open Graph and Twitter tags with the preview image, and JSON-LD (Organization for Cerdify Software, LLC on every page; SoftwareApplication on product pages; FAQPage generated from the page's own `<details>` questions, so the markup always matches what is on the page; BreadcrumbList; Article on guides).

### Changing the logo

The logo appears in three places: `_src/partials/mark.svg` (every page header and footer, and the PNG used in structured data), `favicon.svg`, and `_src/og.html`. Replace those, then run `node _src/build.mjs` and `node _src/render-assets.mjs`.

## Search Console and Bing Webmaster Tools

Either method works; the file method needs no DNS change.

- **File:** Google gives a file such as `google1234abcd.html` and Bing a file `BingSiteAuth.xml`. Put the file, unchanged, in the repository root and merge.
- **Meta tag:** put the code in `_src/site.json` under `verification` (`google-site-verification` or `msvalidate.01`) and run the build. The tag is then on every page.

After verification, submit `https://cerdify.com/sitemap.xml` in both tools.

## Content rules

- Say "review workflow"; never claim Cerdify audits, certifies or guarantees anything.
- Describe only features that are live. Xero and NetSuite are "coming soon".
- Synthetic data in every illustration and example, labelled as such.
- No testimonials, logos or results without written permission.
