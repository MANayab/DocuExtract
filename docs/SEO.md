# Search, answer-engine and AI discoverability

What ships in v1.2.0 and exactly how to get the deployed page
`https://manayab.github.io/DocuExtract/` indexed. Nobody can guarantee a search ranking; this makes the page easy to find, read, quote and index correctly.

## What is built in

| Layer | Where | Purpose |
| --- | --- | --- |
| Title, description, canonical, robots, hreflang | `src/content/seo.ts` -> `<head>` | Correct snippet and the single canonical URL. |
| Open Graph + Twitter cards, `og-image.png` (1200x630) | `<head>`, `public/` | Rich link previews on social apps and chat tools. |
| JSON-LD: `WebSite`, `WebApplication`, `FAQPage` | `<head>` | Site name, app facts and FAQ for rich results and AI assistants. Generated from the same data as the visible FAQ, so they cannot disagree. |
| Pre-rendered HTML inside `#root` | `staticContent()` | Crawlers and AI bots that do not run JavaScript still read the H1, steps, features and FAQ. |
| `sitemap.xml`, `robots.txt` | `public/` | Crawl hints (see the robots caveat below). |
| `llms.txt` | `public/` | Plain-language summary for LLM-based tools (an emerging convention, not a standard). |
| Favicons, `manifest.webmanifest`, `apple-touch-icon.png` | `public/` | Browser tabs, bookmarks, "add to home screen". |
| Truthful copy | `src/config/build.ts` | The page only claims OCR when the build actually bundles it. |

Edit marketing text **only** in `src/content/site.ts`. Tests (`src/tests/unit/seo.test.ts`) enforce title/description length, JSON-LD validity and that FAQ markup equals the visible FAQ.

## Google Search Console: step by step

1. Open <https://search.google.com/search-console> and choose **Add property → URL prefix**.
2. Enter exactly `https://manayab.github.io/DocuExtract/` (a URL-prefix property is the right type for a GitHub Pages project site; you cannot verify the whole `github.io` domain).
3. Choose the **HTML tag** verification method and copy the `content="..."` value.
4. Put that value in `src/content/site.ts` as `googleSiteVerification: '<value>'`, commit and push to `main`, and wait for the deploy to finish.
5. Back in Search Console press **Verify**.
6. **Sitemaps** → add `https://manayab.github.io/DocuExtract/sitemap.xml` → Submit.
7. **URL Inspection** → paste the URL → **Request indexing**.
8. Check **Pages** (indexing status) after a few days and **Enhancements / Rich results** for the FAQ markup. You can pre-check structured data with Google's Rich Results Test using the live URL.

Optional: in Bing Webmaster Tools use **Import from Google Search Console**; Bing also feeds several AI assistants.

## Known caveats (be realistic)

- **robots.txt location.** Crawlers read `robots.txt` only at the host root (`https://manayab.github.io/robots.txt`), which belongs to a user-site repository named `MANayab.github.io`, not to this project. The file in `public/` is still served and documents intent, and the default is "everything allowed", so indexing works without it. The sitemap is submitted directly in Search Console, so it does not depend on robots.txt. If you want a root robots.txt, create the `MANayab/MANayab.github.io` repository with that file.
- **Indexing takes time.** Days to a few weeks for a new page; ranking for competitive terms ("pdf to excel") takes backlinks and time. Links from the GitHub README, a launch post, and directories such as AlternativeTo help more than any tag.
- **Favicon / site name in results** is decided by Google and works best on a domain root. A custom domain (for example `docuextract.app` pointing at GitHub Pages) is the strongest upgrade; change `SITE.url`, `base` in `vite.config.ts`, the sitemap and robots, and re-verify.
- **Sitemap `lastmod`** is static; update it in `public/sitemap.xml` when you publish a release.
- **Single-page app.** Everything lives on one URL, so there is one indexable page. Dedicated pages (for example "GST invoice to Excel") would each need their own URL and content; that is a possible v1.2 addition.

## Answer-engine (AEO) and generative-engine (GEO) guidance

- Questions are phrased the way people ask them and answered in the first sentence, in plain text (see the FAQ in `site.ts`).
- Facts that must stay true are centralised and tested; do not add claims (ratings, user counts, accuracy percentages) that you cannot prove. The JSON-LD deliberately contains no `aggregateRating`.
- Keep `llms.txt` and the FAQ in step when features change.
