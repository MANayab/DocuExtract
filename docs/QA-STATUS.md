# QA status

## Automated

The release-quality gate requires English text extraction critical fields at least 95%, Indian GST extraction at least 90%, multi-invoice splitting at least 90%, and XLSX, invoice CSV, line-items CSV and JSON verification at 100%.

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

## Manual testing completed by the maintainer

The maintainer has reported opening and processing demo and synthetic files, checking the dashboard and review interface, and completing a text-only PDF smoke test. These manual observations are not a substitute for automated CI evidence.

## Pending human QA

- Multilingual OCR on real scans in English, Hindi and German.
- Seller-template end-to-end QA on real seller invoices.
- Opening and checking downloaded XLSX, CSV and JSON files by hand.
- Real invoices and device testing on PC and phone.
