# Sample invoices

Synthetic, fictional invoices for trying DocuExtract and for manual regression checks. No real company, GSTIN or person appears in them.

| File | What it exercises |
| --- | --- |
| `text-invoice.pdf` | Plain text invoice, labelled fields, two line items. |
| `gst-invoice.pdf` | GSTIN for seller and buyer, 18% tax, totals. |
| `label-above-invoice.pdf` | Labels printed **above** their values (invoice number and dates in columns). |
| `gst-table-invoice.pdf` | Per-line GST table: HSN, taxable value, CGST % / amount, SGST % / amount. |
| `multi-invoice.pdf` | One PDF with three invoices; the middle one spans two pages. |
| `scanned-invoice.pdf` | Image-only scan. Needs OCR (see [docs/OCR.md](../docs/OCR.md)); shows "Scanned PDF" otherwise. |

Drop several at once to see the batch dashboard, duplicate detection and the combined Excel export.
