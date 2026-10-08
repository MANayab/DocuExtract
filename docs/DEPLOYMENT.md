# Deployment

GitHub Pages must use **GitHub Actions** as its source. The deployment workflow runs on pushes to `main`, builds with Node 20 and deploys `dist` using the Pages artifact/deployment actions.

The Vite base is `/DocuExtract/`. `public/.nojekyll` prevents Jekyll processing. `public/404.html` provides a project-site fallback redirect for direct SPA paths.
