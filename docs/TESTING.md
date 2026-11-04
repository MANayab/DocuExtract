# Testing

DocuExtract uses TypeScript checks, ESLint, Vitest, an offline extraction-quality benchmark, Playwright and an OCR asset-size audit.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run benchmark
npx playwright install chromium
npm run test:e2e
```

The extraction-quality gate requires:

- English text extraction critical fields: at least 95%.
- Indian GST extraction: at least 90%.
- Multi-invoice splitting: at least 90%.
- XLSX, invoice CSV, line-items CSV and JSON verification: 100%.

The benchmark tracks invoice number, date, seller, subtotal, tax, grand total and line items separately. A green build does not replace the benchmark.

Playwright runs against the production build. Documentation consistency tests use `path.resolve(process.cwd(), ...)` so they remain portable across Windows and Linux.

Human QA is separate from automated coverage. Real scans, seller-template workflows, downloaded exports and device testing remain pending until completed.
