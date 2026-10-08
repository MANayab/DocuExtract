# Testing

Unit tests cover cell sanitization, date/currency/number normalization and arithmetic validation. Integration tests cover parser behavior and the upload UI. `e2e/smoke.spec.ts` runs against the production build in a real browser: it checks the shell, uploads a synthetic PDF through to the review screen, and checks that a corrupt PDF produces a visible error.

Run:

```bash
npm run typecheck
npm run lint
npm run test
npx playwright install chromium   # once
npm run test:e2e
npm run build
```

The requested synthetic PDF fixture strategy uses `pdf-lib` in development/test tooling rather than committing binary PDFs. Fixture coverage should include basic, GST, multi-page, discount, missing-field, malformed and empty PDFs as the fixture suite is expanded.

Regression coverage: `parser.test.ts` builds positioned spans (as pdf.js returns them) so that label/value parsing is tested on real line structure, including side-by-side header fields, label/value columns, CGST/SGST, per-party GSTIN, descriptions containing digits, and ambiguous dates.
