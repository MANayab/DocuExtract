# Extraction specification

## Canonical fields
Every extracted scalar uses `{ value, confidence, source, warning? }`. Confidence bands are HIGH 90–100, MEDIUM 70–89, LOW 0–69. Medium and low values are marked for review.

Header detection uses labelled patterns for invoice number/date/due date/totals plus currency-symbol detection. Party detection uses common seller/buyer labels and conservative email, phone and GSTIN patterns.

Line-item detection is heuristic and uses text rows plus numeric token patterns. Positional spans are retained from pdf.js so column clustering can be expanded without changing the canonical model.

Normalization supports ISO dates, common numeric date formats, month-name dates, currency symbols, Indian comma grouping and parentheses negatives.

## Layout handling (1.1.0)

- Text spans are grouped into rows (vertical tolerance scales with text height, so OCR works) and rows into cells; a horizontal gap above 8 pt starts a new cell.
- **Label above value:** when a header row holds a label cell ("Invoice No.") and the next row has a cell overlapping it horizontally, that cell is the value (confidence below a same-line match). A value that is itself a label is rejected.
- **Line-item columns:** header cells are classified (`serial`, `qty`, `rate`, `amount`, `taxable`, `discount`, `taxRate`, `taxAmount`, `other`, `text`) and the numeric cells of each row are aligned to them from the right. Merged tax headers ("SGST % SGST Amt") are split. CGST % + SGST % add up to the line's tax rate.
- **Validation** accepts line totals with or without tax (matching tax amount or rate) and line sums with or without the tax column.
- **Multiple invoices:** a PDF is split where the first word of the invoice number changes between pages; pages without a number continue the current invoice.
- **OCR:** words become spans (PDF points, origin bottom-left); parsing is identical, then every value is marked `ocr` and capped at 75%.
- **Review status:** `REVIEW` when a check fails, the invoice number or grand total is missing, no line items were found, overall confidence is below 70, the invoice number was guessed, or the extraction carries a warning (OCR). Currency defaults, seller guesses and ambiguous dates are flagged on the field only.
