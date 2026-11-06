# Deployment

GitHub Pages must use **GitHub Actions** as its source. The deployment workflow runs on pushes to `main`, builds with Node 20 and deploys `dist` using the Pages artifact/deployment actions.

**Merging a pull request into `main` can trigger a production deployment automatically.** Feature branches and pull-request checks do not deploy production. Do not merge or manually dispatch the deployment workflow as part of pre-commercial verification.

The Vite base is `/DocuExtract/`. `public/.nojekyll` prevents Jekyll processing. `public/404.html` provides a project-site fallback redirect for direct SPA paths.

## Offline assets

`npm run build` runs the OCR and PDF.js asset preparation hooks. The build generates a content-derived PWA build ID and `precache-manifest.json`, including hashed app chunks and PDF.js standard fonts. The service worker is built under `/DocuExtract/sw.js`. OCR language models are cached separately after a user selects or uses the language online.

## Deployment verification

After an approved deployment, verify the deployed commit, Pages environment status, `/DocuExtract/` base path, `sw.js` scope and offline behavior. Follow `docs/SEO.md` to verify the site in Google Search Console, submit the sitemap and request indexing.
