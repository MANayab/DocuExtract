/**
 * Single source of truth for the site's marketing copy. The React UI, the
 * pre-rendered HTML that crawlers read, and the JSON-LD structured data are
 * all generated from this file, so they can never drift apart.
 */
export const SITE = {
  name: 'DocuExtract',
  url: 'https://manayab.github.io/DocuExtract/',
  title: 'DocuExtract: Free PDF Invoice to Excel Converter',
  h1: 'PDF Invoice to Excel',
  tagline: 'Private, browser-only invoice extraction',
  description:
    'Convert PDF invoices to Excel, CSV or JSON in your browser. Batch upload, GST-aware, OCR for scans. Free and open source: files never leave your device.',
  repo: 'https://github.com/MANayab/DocuExtract',
  author: 'MANayab',
  authorUrl: 'https://github.com/MANayab',
  version: '1.3.1',
  themeColor: '#2563eb',
  keywords:
    'pdf invoice to excel, invoice data extraction, gst invoice to excel, invoice ocr, convert invoice pdf to csv, private invoice parser',
  /** Paste the token from Google Search Console (HTML tag method); injected into <head> at build time. */
  googleSiteVerification: 'LG9hgW4y64yMzHTyEO7wEkTWzpy2BdXJJF6ilYaGp9U',
} as const;

export interface Feature {
  id: string;
  title: string;
  body: string;
}

export function features(ocrBundled: boolean): Feature[] {
  return [
    {
      id: 'private',
      title: 'Private by design',
      body: 'PDFs are read inside your browser tab. There is no server, account, database or analytics, so invoice data never leaves your device.',
    },
    {
      id: 'batch',
      title: 'Batch and multi-invoice',
      body: 'Drop up to 50 PDFs at once. A single PDF that contains several invoices is split automatically, and everything exports as one workbook.',
    },
    {
      id: 'gst',
      title: 'GST-aware',
      body: 'Reads GSTIN numbers, CGST, SGST and IGST, and per-line tax columns such as HSN, taxable value and tax rate.',
    },
    {
      id: 'validated',
      title: 'Validated, not guessed',
      body: 'Line totals, tax and grand total are cross-checked. Anything that does not add up is flagged for review instead of being silently corrected.',
    },
    ocrBundled
      ? {
          id: 'ocr',
          title: 'Scanned invoices (OCR)',
          body: 'Image-only PDFs can be read with OCR that also runs locally in your browser. OCR results are always marked as lower confidence.',
        }
      : {
          id: 'ocr',
          title: 'Scanned PDF detection',
          body: 'Image-only PDFs are detected and listed as needing OCR instead of being guessed. Optional local OCR can be added to a build.',
        },
    {
      id: 'export',
      title: 'Excel-ready exports',
      body: 'Download one Excel workbook with six sheets, CSV files for invoices or line items, or JSON. Spreadsheet formula injection is blocked.',
    },
  ];
}

export interface Step {
  title: string;
  body: string;
}

export const STEPS: Step[] = [
  {
    title: 'Drop your PDFs',
    body: 'Drag in one invoice or a whole folder of up to 50. Text PDFs are read instantly.',
  },
  {
    title: 'Review what was flagged',
    body: 'Every field shows its confidence. Fix anything marked Review and watch the checks update.',
  },
  {
    title: 'Download Excel, CSV or JSON',
    body: 'Export all invoices together, one row per invoice, with line items, taxes and validation sheets.',
  },
];

export interface FaqItem {
  q: string;
  a: string;
}

/** `ocrBundled` is true when this build ships the Tesseract files (see docs/OCR.md). */
export function faqItems(ocrBundled: boolean): FaqItem[] {
  return [
    {
      q: 'Is DocuExtract free?',
      a: 'Yes. DocuExtract is free and open source under the MIT license. There is no account or subscription. A batch holds up to 50 PDFs and each PDF can be up to 25 MB and 100 pages.',
    },
    {
      q: 'Are my invoices uploaded to a server?',
      a: 'No. PDFs are read and processed inside your browser. The app has no backend, database or analytics, and you can confirm this in your browser Network tab while extracting.',
    },
    {
      q: 'How do I convert a PDF invoice to Excel?',
      a: 'Drop one or more text-based PDF invoices onto the page, review any fields marked Review, then choose Download Excel. The workbook has one row per invoice plus line items, parties, taxes, validation and extraction metadata sheets.',
    },
    {
      q: 'Does it work with GST invoices?',
      a: 'Yes. It reads GSTIN numbers, CGST, SGST and IGST amounts and per-line tax columns (HSN, taxable value, tax rate and tax amount), then checks that line items, tax and totals reconcile. Always review the result before filing returns.',
    },
    {
      q: 'Can it read scanned invoices?',
      a: ocrBundled
        ? 'Yes. Scanned or image-only PDFs can be read with built-in English OCR that runs locally in your browser. OCR results are less accurate, so every value is marked as lower confidence and needs review.'
        : 'Not in this build. Scanned or image-only PDFs need OCR, which is optional and not bundled here; they are listed as needing OCR instead of being guessed.',
    },
    {
      q: 'How accurate is the extraction?',
      a: 'Text PDFs created by accounting software are read most reliably. Each field has a confidence level and every invoice is validated; invoices whose numbers do not reconcile are marked Review. Extraction is heuristic, so verify values before using them for accounting or tax.',
    },
    {
      q: 'Can I process many invoices at once?',
      a: 'Yes. Drop up to 50 PDFs. They are processed one at a time, a PDF containing several invoices is split automatically, and all invoices export together as a single Excel, CSV or JSON file.',
    },
    {
      q: 'Where is the source code?',
      a: `The code is public on GitHub at ${SITE.repo} under the MIT license.`,
    },
  ];
}

export const FOOTER_LINKS = [
  { label: 'GitHub', href: SITE.repo },
  { label: 'Privacy', href: `${SITE.repo}/blob/main/PRIVACY.md` },
  { label: 'Terms', href: `${SITE.repo}/blob/main/TERMS.md` },
  { label: 'Security', href: `${SITE.repo}/blob/main/SECURITY.md` },
  {
    label: 'Report an extraction failure',
    href: `${SITE.repo}/issues/new?template=extraction-failure.md`,
  },
] as const;
