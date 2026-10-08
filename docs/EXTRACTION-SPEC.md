# Extraction specification

## Canonical fields
Every extracted scalar uses `{ value, confidence, source, warning? }`. Confidence bands are HIGH 90–100, MEDIUM 70–89, LOW 0–69. Medium and low values are marked for review.

Header detection uses labelled patterns for invoice number/date/due date/totals plus currency-symbol detection. Party detection uses common seller/buyer labels and conservative email, phone and GSTIN patterns.

Line-item detection is heuristic and uses text rows plus numeric token patterns. Positional spans are retained from pdf.js so column clustering can be expanded without changing the canonical model.

Normalization supports ISO dates, common numeric date formats, month-name dates, currency symbols, Indian comma grouping and parentheses negatives.

Multiple invoices in one PDF is intentionally a Phase 2 feature.
