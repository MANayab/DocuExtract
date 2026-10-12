# Deployment

GitHub Pages must use **GitHub Actions** as its source. The deployment workflow runs on pushes to `main`, builds with Node 20 and deploys `dist` using the Pages artifact/deployment actions.

The Vite base is `/DocuExtract/`. `public/.nojekyll` prevents Jekyll processing. `public/404.html` provides a project-site fallback redirect for direct SPA paths.

## OCR files

`npm run build` runs `scripts/prepare-ocr-assets.mjs` first. If `@tesseract.js-data/eng` is installed, `dist/ocr/` (about 15 MB) is deployed along with the app; otherwise the build succeeds without OCR. See `docs/OCR.md`.

## After deploying

Follow `docs/SEO.md` to verify the site in Google Search Console, submit the sitemap and request indexing.
