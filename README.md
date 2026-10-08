# DocuExtract — PDF Invoice to Excel Extractor

DocuExtract converts invoice PDFs into structured XLSX, CSV and JSON entirely in the browser. It has no backend, account, database, analytics or telemetry.

## Support matrix
| PDF type | Support |
|---|---|
| Text-based | YES — reliably supported |
| Scanned PDF | NOT YET — OCR is not implemented in v1.0.0 (planned for Phase 2) |
| Image-only | NOT YET — OCR is not implemented in v1.0.0 (planned for Phase 2) |
| Password-protected | LIMITED — encrypted files are rejected unless provided as an already-decrypted PDF |
| Corrupt | NO |
| Handwritten | NOT GUARANTEED |
| Multi-page | YES, up to 100 pages |
| Multiple invoices per PDF | PHASE 2 |

**Important:** extraction is heuristic. Review every output before using it for accounting, tax, payment, or legal records.

## Known limitations (v1.0.0)
- **OCR is not implemented.** Scanned or image-only PDFs show a warning and cannot be extracted; the "Enable OCR" button explains this instead of downloading anything.
- Labels and values must be on the same line or in neighbouring columns of the same row. Layouts that put a label *above* its value are not read.
- Numeric dates such as `05/09/2026` are read as **DD/MM/YYYY** and flagged for confirmation.
- Line items are detected with column gaps and the table header; unusual tables may need manual correction in the review screen.
- One invoice per PDF.
- The CSV export contains line items only; use XLSX or JSON for the full invoice.

## Local development
Requires Node 20 or newer (CI uses Node 20).

```bash
npm ci
npm run typecheck
npm run lint
npm run test
npm run build
npm run dev
```

Preview a production build with `npm run preview`, then open the URL it prints (it includes the `/DocuExtract/` path).

End-to-end tests need a browser once: `npx playwright install chromium`, then `npm run test:e2e`.

## GitHub Pages
The Vite base path is `/DocuExtract/`. The repository's Pages source should be **GitHub Actions**. Push to `main`; `.github/workflows/deploy.yml` builds and deploys the `dist` directory.

## Privacy
Files are processed locally by this application and are not uploaded by application code. Verify your own browser network activity if your environment requires independent confirmation. See `PRIVACY.md`.

## Security
Exports sanitize spreadsheet formula-triggering cells. Invoice data is not written to URLs, localStorage or sessionStorage. PDF buffers are released and PDF documents are destroyed after processing. React rendering does not use `dangerouslySetInnerHTML`.
