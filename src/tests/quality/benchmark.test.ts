import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => vi.restoreAllMocks());
import { invoicesToCsv, lineItemsToCsv } from '../../features/export/csvExporter';
import { invoicesToJson } from '../../features/export/jsonExporter';
import { invoicesToXlsx } from '../../features/export/xlsxExporter';
import { parseInvoice } from '../../features/extraction/invoiceParser';
import { splitInvoices } from '../../features/extraction/splitInvoices';
import { loadPdf } from '../../features/pdf/pdfLoader';
import { extractPdf } from '../../features/pdf/pdfTextExtractor';
import { validateInvoice } from '../../features/validation/invoiceValidator';
import { generateFixture, type FixtureKind } from '../fixtures/generateFixtures';
import manifest from './benchmark-fixtures.json';

type ExpectedLine = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
};

type ExpectedFields = {
  invoiceNumber: string;
  invoiceDate: string;
  sellerName: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  currency: string;
  lineItems: ExpectedLine[];
};

type BenchmarkFixture = {
  id: string;
  kind: string;
  qualityGroup: 'textEnglish' | 'indianGst' | 'multiInvoice' | 'excluded';
  critical?: ExpectedFields;
  expectedInvoices?: ExpectedFields[];
  expectedError?: string;
};

type Accuracy = { correct: number; total: number; percentage: number };
type GateMetric = { minimum: number; actual: number; passed: boolean };

const fixtures = manifest.fixtures as BenchmarkFixture[];
const outputDir = join(process.cwd(), 'output');
const STABLE_FIELDS = [
  'invoiceNumber',
  'invoiceDate',
  'sellerName',
  'subtotal',
  'taxAmount',
  'grandTotal',
] as const;

function equal(actual: unknown, expected: unknown) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

function percentage(correct: number, total: number) {
  return total ? Number(((correct / total) * 100).toFixed(2)) : 0;
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) resolve(reader.result);
      else reject(new TypeError('XLSX export did not produce an ArrayBuffer.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read XLSX export.'));
    reader.readAsArrayBuffer(blob);
  });
}

function blobToText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new TypeError('Export did not produce text.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read export text.'));
    reader.readAsText(blob);
  });
}

async function extractBenchmarkPdf(file: File) {
  try {
    return await extractPdf(file);
  } catch (error) {
    try {
      await loadPdf(await file.arrayBuffer());
    } catch (parserError) {
      const details =
        parserError instanceof Error
          ? `${parserError.message}\\n${parserError.stack ?? ''}`
          : String(parserError);
      throw new Error(`PDF.js failed to load benchmark fixture ${file.name}: ${details}`, {
        cause: error,
      });
    }
    throw error;
  }
}

function actualFields(invoice: ReturnType<typeof parseInvoice>): ExpectedFields {
  return {
    invoiceNumber: invoice.invoiceNumber.value,
    invoiceDate: invoice.invoiceDate.value,
    sellerName: invoice.seller.name.value,
    subtotal: invoice.subtotal.value,
    taxAmount: invoice.taxTotal.value,
    grandTotal: invoice.grandTotal.value,
    currency: invoice.currency.value,
    lineItems: invoice.items.map((item) => ({
      description: item.description.value,
      quantity: item.quantity.value,
      rate: item.unitPrice.value,
      amount: item.lineTotal.value,
      discount: item.discount.value,
      taxRate: item.taxRate.value,
      taxAmount: item.taxAmount.value,
    })),
  };
}

function compareFields(actual: ExpectedFields, expected: ExpectedFields) {
  return Object.fromEntries(
    Object.entries(expected).map(([field, expectedValue]) => [
      field,
      equal(actual[field as keyof ExpectedFields], expectedValue),
    ]),
  ) as Record<keyof ExpectedFields, boolean>;
}

describe('offline extraction quality benchmark', () => {
  it('enforces v1.5.1 field-level, splitting and export quality thresholds', async () => {
    const standardFontWarningSpies = [
      vi.spyOn(console, 'warn'),
      vi.spyOn(console, 'error'),
      vi.spyOn(console, 'log'),
    ];
    const report = {
      generatedAt: new Date().toISOString(),
      source:
        'Repository-owned synthetic PDFs processed through extractPdf, splitInvoices and parseInvoice',
      currencyPolicy: [
        'A recognized currency marker is extracted explicitly. If none is present, the parser defaults',
        'to INR with low confidence and a review warning; INR in these fixtures is a fallback, not invoice',
        'evidence.',
      ].join(' '),
      totalInvoicesProcessed: 0,
      fieldAccuracy: {} as Record<string, Accuracy>,
      groupAccuracy: {} as Record<string, Accuracy & { minimum: number; passed: boolean }>,
      invoicesRequiringCorrection: 0,
      averageCorrectedFieldsPerInvoice: 0,
      exportSuccess: {
        xlsx: 0,
        invoiceCsv: 0,
        lineItemsCsv: 0,
        json: 0,
        total: 0,
      },
      exportVerification: {} as Record<string, GateMetric>,
      splitAccuracy: {
        expectedInvoices: 0,
        actualInvoices: 0,
        fixturesPassed: 0,
        fixturesTotal: 0,
        percentage: 0,
      },
      multiInvoiceSplitting: {
        expectedInvoices: 0,
        actualInvoices: 0,
        fixturesPassed: 0,
        fixturesTotal: 0,
        percentage: 0,
      },
      zeroErrorInvoices: 0,
      criticalFieldErrorInvoices: 0,
      zeroErrorInvoicePercentage: 0,
      noRegression: { fields: [...STABLE_FIELDS], passed: false },
      qualityGate: {
        textEnglishCriticalFieldAccuracy: { minimum: 95, actual: 0, passed: false } as GateMetric,
        indianGstCriticalFieldAccuracy: { minimum: 90, actual: 0, passed: false } as GateMetric,
        multiInvoiceSplittingAccuracy: { minimum: 90, actual: 0, passed: false } as GateMetric,
        noRegression: { minimum: 100, actual: 0, passed: false } as GateMetric,
        overallPassed: false,
      },
      lineItemDiagnostics: [] as Array<Record<string, unknown>>,
      fixtureResults: [] as Array<Record<string, unknown>>,
      limitations: [
        'Synthetic fixtures do not represent the full diversity of real supplier invoices.',
        'HSN/SAC is not represented in the current InvoiceItem schema and is therefore not scored.',
        'German and Hindi OCR fixtures remain experimental and are not counted as successful text extraction.',
      ],
    };

    const fieldCounts = new Map<string, { correct: number; total: number }>();
    const groupCounts = new Map<string, { correct: number; total: number }>();
    const exportVerifiedInvoices = { xlsx: 0, invoiceCsv: 0, lineItemsCsv: 0, json: 0 };
    let correctedFields = 0;
    let expectedInvoicesTotal = 0;
    let actualInvoicesTotal = 0;
    let exactSplitFixtures = 0;
    let splitFixtures = 0;
    let multiExactSplitFixtures = 0;
    let multiSplitFixtures = 0;
    let multiExpectedInvoices = 0;
    let multiActualInvoices = 0;

    for (const fixture of fixtures) {
      const bytes = await generateFixture(fixture.kind as FixtureKind);
      const file = {
        name: `${fixture.id}.pdf`,
        arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
      } as File;

      if (fixture.expectedError) {
        let rejected = false;
        try {
          await extractPdf(file);
        } catch {
          rejected = true;
        }
        expect(rejected, `${fixture.id} should be rejected as malformed`).toBe(true);
        report.fixtureResults.push({ id: fixture.id, rejectedAsExpected: true });
        continue;
      }

      const raw = await extractBenchmarkPdf(file);
      const segments = splitInvoices(raw);
      const invoices = segments.map((segment) => parseInvoice(segment.raw));
      const expected = fixture.expectedInvoices ?? (fixture.critical ? [fixture.critical] : []);
      expect(expected.length, `${fixture.id} must define expected invoice values`).toBeGreaterThan(
        0,
      );

      expectedInvoicesTotal += expected.length;
      actualInvoicesTotal += invoices.length;
      splitFixtures += 1;
      if (invoices.length === expected.length) exactSplitFixtures += 1;
      if (fixture.qualityGroup === 'multiInvoice') {
        multiSplitFixtures += 1;
        multiExpectedInvoices += expected.length;
        multiActualInvoices += invoices.length;
        if (invoices.length === expected.length) multiExactSplitFixtures += 1;
      }

      const perInvoiceResults: Array<Record<string, unknown>> = [];
      let fixtureCorrect = 0;
      let fixtureTotal = 0;
      let fixtureHasErrors = invoices.length !== expected.length;

      for (let index = 0; index < expected.length; index++) {
        const expectedInvoice = expected[index];
        const invoice = invoices[index];
        if (!invoice) {
          fixtureHasErrors = true;
          for (const field of Object.keys(expectedInvoice)) {
            const count = fieldCounts.get(field) ?? { correct: 0, total: 0 };
            count.total += 1;
            fieldCounts.set(field, count);
            if (fixture.qualityGroup !== 'excluded') {
              const groupCount = groupCounts.get(fixture.qualityGroup) ?? { correct: 0, total: 0 };
              groupCount.total += 1;
              groupCounts.set(fixture.qualityGroup, groupCount);
            }
            correctedFields += 1;
            fixtureTotal += 1;
          }
          report.criticalFieldErrorInvoices += 1;
          report.invoicesRequiringCorrection += 1;
          continue;
        }

        const actual = actualFields(invoice);
        expect(invoice.currency.value).toBe('INR');
        expect(invoice.currency.confidence).toBe(40);
        expect(invoice.currency.warning).toBe(
          'No currency symbol found; defaulted to INR. Please confirm.',
        );
        const fieldResults = compareFields(actual, expectedInvoice);
        const matchedCount = Object.values(fieldResults).filter(Boolean).length;
        const fieldCount = Object.keys(fieldResults).length;
        fixtureCorrect += matchedCount;
        fixtureTotal += fieldCount;
        const hasErrors = matchedCount !== fieldCount;
        fixtureHasErrors ||= hasErrors;

        for (const [field, matched] of Object.entries(fieldResults)) {
          const count = fieldCounts.get(field) ?? { correct: 0, total: 0 };
          count.total += 1;
          if (matched) count.correct += 1;
          else correctedFields += 1;
          fieldCounts.set(field, count);

          if (fixture.qualityGroup !== 'excluded') {
            const groupCount = groupCounts.get(fixture.qualityGroup) ?? { correct: 0, total: 0 };
            groupCount.total += 1;
            if (matched) groupCount.correct += 1;
            groupCounts.set(fixture.qualityGroup, groupCount);
          }
        }

        if (hasErrors) {
          report.criticalFieldErrorInvoices += 1;
          report.invoicesRequiringCorrection += 1;
        } else {
          report.zeroErrorInvoices += 1;
        }

        perInvoiceResults.push({
          invoiceNumber: actual.invoiceNumber,
          currencyReview: {
            value: invoice.currency.value,
            confidence: invoice.currency.confidence,
            warning: invoice.currency.warning,
          },
          fieldResults,
          actualFields: actual,
          validationValid: validateInvoice(invoice).valid,
        });
      }

      const entries = invoices.map((invoice) => ({
        invoice,
        checks: validateInvoice(invoice).checks,
      }));
      const expectedLineCount = expected.reduce((sum, item) => sum + item.lineItems.length, 0);
      const actualLineCount = invoices.reduce((sum, invoice) => sum + invoice.items.length, 0);
      const expectedDescriptions = expected.flatMap((item) =>
        item.lineItems.map((line) => line.description),
      );

      const workbookBlob = await invoicesToXlsx(entries);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await blobToArrayBuffer(workbookBlob));
      const invoiceSheet = workbook.getWorksheet('Invoices');
      const lineItemsSheet = workbook.getWorksheet('Line Items');
      expect(invoiceSheet?.rowCount).toBe(invoices.length + 1);
      expect(lineItemsSheet?.rowCount).toBe(actualLineCount + 1);
      const exportedInvoiceNumbers = invoiceSheet?.getColumn(1).values.map(String) ?? [];
      const exportedDescriptions = lineItemsSheet?.getColumn(3).values.map(String) ?? [];
      for (const invoice of invoices) {
        if (invoice.invoiceNumber.value) {
          expect(exportedInvoiceNumbers).toContain(invoice.invoiceNumber.value);
        }
      }
      for (const description of expectedDescriptions) {
        expect(exportedDescriptions).toContain(description);
      }
      exportVerifiedInvoices.xlsx += invoices.length;

      const invoiceCsv = await blobToText(invoicesToCsv(entries));
      expect(invoiceCsv).toContain('Invoice Number');
      expect(invoiceCsv.split(/\r?\n/)).toHaveLength(invoices.length + 1);
      for (const invoice of invoices) {
        if (invoice.invoiceNumber.value) expect(invoiceCsv).toContain(invoice.invoiceNumber.value);
      }
      exportVerifiedInvoices.invoiceCsv += invoices.length;

      const itemsCsv = await blobToText(lineItemsToCsv(entries));
      expect(itemsCsv).toContain('Description');
      expect(itemsCsv.split(/\r?\n/)).toHaveLength(actualLineCount + 1);
      for (const description of expectedDescriptions) expect(itemsCsv).toContain(description);
      exportVerifiedInvoices.lineItemsCsv += invoices.length;

      const json = JSON.parse(await blobToText(invoicesToJson(entries))) as {
        invoices: Array<{
          invoice: {
            invoiceNumber: { value: string };
            items: Array<{ description: { value: string } }>;
          };
        }>;
      };
      expect(json.invoices).toHaveLength(invoices.length);
      expect(json.invoices.every((entry) => Boolean(entry.invoice))).toBe(true);
      expect(
        json.invoices.map((entry) => entry.invoice.invoiceNumber.value).filter(Boolean),
      ).toEqual(invoices.map((invoice) => invoice.invoiceNumber.value).filter(Boolean));
      expect(
        json.invoices.flatMap((entry) => entry.invoice.items.map((item) => item.description.value)),
      ).toEqual(expectedDescriptions);
      exportVerifiedInvoices.json += invoices.length;

      report.totalInvoicesProcessed += invoices.length;
      report.fixtureResults.push({
        id: fixture.id,
        qualityGroup: fixture.qualityGroup,
        expectedInvoiceCount: expected.length,
        actualInvoiceCount: invoices.length,
        fieldAccuracy: fixtureTotal ? percentage(fixtureCorrect, fixtureTotal) : 0,
        invoiceResults: perInvoiceResults,
        exportVerified: { xlsx: true, invoiceCsv: true, lineItemsCsv: true, json: true },
      });
      report.lineItemDiagnostics.push({
        fixture: fixture.id,
        previousRootCause:
          expectedLineCount === 0
            ? null
            : 'Single-spaced PDF text produced one unaligned cell; the former numeric token accepted whitespace and merged quantity/rate/amount values. Header roles were also unavailable for single-spaced GST and discount columns.',
        fixApplied:
          expectedLineCount === 0
            ? null
            : 'Whitespace-delimited numeric tokens, header-derived column roles and wrapped-description carry-forward.',
        expectedCount: expectedLineCount,
        actualCount: actualLineCount,
        expected: expected.flatMap((item) => item.lineItems),
        actual: invoices.flatMap((invoice) =>
          invoice.items.map((item) => ({
            description: item.description.value,
            quantity: item.quantity.value,
            rate: item.unitPrice.value,
            amount: item.lineTotal.value,
            discount: item.discount.value,
            taxRate: item.taxRate.value,
            taxAmount: item.taxAmount.value,
          })),
        ),
        matched: equal(
          expected.flatMap((item) => item.lineItems),
          invoices.flatMap((invoice) =>
            invoice.items.map((item) => ({
              description: item.description.value,
              quantity: item.quantity.value,
              rate: item.unitPrice.value,
              amount: item.lineTotal.value,
              discount: item.discount.value,
              taxRate: item.taxRate.value,
              taxAmount: item.taxAmount.value,
            })),
          ),
        ),
      });

      if (fixtureHasErrors && fixtureTotal === 0) {
        report.invoicesRequiringCorrection += invoices.length;
      }
    }

    for (const [field, count] of fieldCounts) {
      report.fieldAccuracy[field] = {
        ...count,
        percentage: percentage(count.correct, count.total),
      };
    }
    for (const [group, count] of groupCounts) {
      const minimum = group === 'textEnglish' ? 95 : group === 'indianGst' ? 90 : 95;
      report.groupAccuracy[group] = {
        ...count,
        percentage: percentage(count.correct, count.total),
        minimum,
        passed: percentage(count.correct, count.total) >= minimum,
      };
    }

    const processed = report.totalInvoicesProcessed || 1;
    report.averageCorrectedFieldsPerInvoice = Number((correctedFields / processed).toFixed(2));
    report.zeroErrorInvoicePercentage = percentage(report.zeroErrorInvoices, processed);
    report.exportSuccess = {
      xlsx: exportVerifiedInvoices.xlsx,
      invoiceCsv: exportVerifiedInvoices.invoiceCsv,
      lineItemsCsv: exportVerifiedInvoices.lineItemsCsv,
      json: exportVerifiedInvoices.json,
      total:
        exportVerifiedInvoices.xlsx +
        exportVerifiedInvoices.invoiceCsv +
        exportVerifiedInvoices.lineItemsCsv +
        exportVerifiedInvoices.json,
    };

    report.splitAccuracy = {
      expectedInvoices: expectedInvoicesTotal,
      actualInvoices: actualInvoicesTotal,
      fixturesPassed: exactSplitFixtures,
      fixturesTotal: splitFixtures,
      percentage: percentage(exactSplitFixtures, splitFixtures),
    };
    report.multiInvoiceSplitting = {
      expectedInvoices: multiExpectedInvoices,
      actualInvoices: multiActualInvoices,
      fixturesPassed: multiExactSplitFixtures,
      fixturesTotal: multiSplitFixtures,
      percentage: percentage(multiExactSplitFixtures, multiSplitFixtures),
    };

    for (const key of ['xlsx', 'invoiceCsv', 'lineItemsCsv', 'json'] as const) {
      const actual = percentage(exportVerifiedInvoices[key], processed);
      report.exportVerification[key] = { minimum: 100, actual, passed: actual === 100 };
    }

    const stableFieldAccuracy = STABLE_FIELDS.map(
      (field) => report.fieldAccuracy[field]?.percentage ?? 0,
    );
    const noRegressionPassed = stableFieldAccuracy.every((value) => value === 100);
    report.noRegression.passed = noRegressionPassed;
    report.qualityGate.textEnglishCriticalFieldAccuracy = {
      minimum: 95,
      actual: report.groupAccuracy.textEnglish?.percentage ?? 0,
      passed: (report.groupAccuracy.textEnglish?.percentage ?? 0) >= 95,
    };
    report.qualityGate.indianGstCriticalFieldAccuracy = {
      minimum: 90,
      actual: report.groupAccuracy.indianGst?.percentage ?? 0,
      passed: (report.groupAccuracy.indianGst?.percentage ?? 0) >= 90,
    };
    report.qualityGate.multiInvoiceSplittingAccuracy = {
      minimum: 90,
      actual: report.multiInvoiceSplitting.percentage,
      passed: report.multiInvoiceSplitting.percentage >= 90,
    };
    report.qualityGate.noRegression = {
      minimum: 100,
      actual: noRegressionPassed ? 100 : Math.min(...stableFieldAccuracy),
      passed: noRegressionPassed,
    };

    const exportsPassed = Object.values(report.exportVerification).every((metric) => metric.passed);
    report.qualityGate.overallPassed =
      report.qualityGate.textEnglishCriticalFieldAccuracy.passed &&
      report.qualityGate.indianGstCriticalFieldAccuracy.passed &&
      report.qualityGate.multiInvoiceSplittingAccuracy.passed &&
      report.qualityGate.noRegression.passed &&
      exportsPassed;

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'benchmark-report.json'), JSON.stringify(report, null, 2));

    const gateRows = [
      [
        'Text-based English critical-field accuracy',
        report.qualityGate.textEnglishCriticalFieldAccuracy,
      ],
      ['Indian GST critical-field accuracy', report.qualityGate.indianGstCriticalFieldAccuracy],
      ['Multi-invoice splitting accuracy', report.qualityGate.multiInvoiceSplittingAccuracy],
      ['Previously passing fields (no regression)', report.qualityGate.noRegression],
      ...Object.entries(report.exportVerification).map(([name, metric]) => [
        `${name} export verification`,
        metric,
      ]),
    ] as Array<[string, GateMetric]>;
    const markdown = [
      '# DocuExtract extraction quality benchmark',
      '',
      `Generated: ${report.generatedAt}`,
      `Invoices processed: ${report.totalInvoicesProcessed}`,
      `Zero-error invoices: ${report.zeroErrorInvoices} (${report.zeroErrorInvoicePercentage}%)`,
      `Invoices requiring correction: ${report.invoicesRequiringCorrection}`,
      `Average corrected fields per invoice: ${report.averageCorrectedFieldsPerInvoice}`,
      `Overall release gate: ${report.qualityGate.overallPassed ? 'PASS' : 'FAIL'}`,
      '',
      '## Release thresholds',
      '',
      '| Gate | Minimum | Actual | Result |',
      '|---|---:|---:|---|',
      ...gateRows.map(
        ([name, metric]) =>
          `| ${name} | ${metric.minimum}% | ${metric.actual}% | ${metric.passed ? 'PASS' : 'FAIL'} |`,
      ),
      '',
      '## Critical field accuracy',
      '',
      '| Critical field | Correct | Total | Accuracy |',
      '|---|---:|---:|---:|',
      ...Object.entries(report.fieldAccuracy).map(
        ([field, value]) =>
          `| ${field} | ${value.correct} | ${value.total} | ${value.percentage}% |`,
      ),
      '',
      '## Line-item diagnostics',
      '',
      '| Fixture | Expected items | Actual items | Exact match |',
      '|---|---:|---:|---|',
      ...report.lineItemDiagnostics.map(
        (item) =>
          `| ${String(item.fixture)} | ${String(item.expectedCount)} | ${String(item.actualCount)} | ${
            item.matched ? 'yes' : 'no'
          } |`,
      ),
      '',
      '## Currency policy',
      '',
      report.currencyPolicy,
      '',
      '## Limitations',
      ...report.limitations.map((item) => `- ${item}`),
    ].join('\n');
    writeFileSync(join(outputDir, 'benchmark-report.md'), markdown);

    expect(
      report.qualityGate.textEnglishCriticalFieldAccuracy.passed,
      'Text-based English fixtures must reach 95% critical-field accuracy',
    ).toBe(true);
    expect(
      report.qualityGate.indianGstCriticalFieldAccuracy.passed,
      'Indian GST fixtures must reach 90% critical-field accuracy',
    ).toBe(true);
    expect(
      report.qualityGate.multiInvoiceSplittingAccuracy.passed,
      'Multi-invoice splitting must reach 90% accuracy',
    ).toBe(true);
    expect(
      report.qualityGate.noRegression.passed,
      'Previously passing invoice header and total fields must not regress',
    ).toBe(true);
    for (const [name, metric] of Object.entries(report.exportVerification)) {
      expect(metric.passed, `${name} export verification must be 100%`).toBe(true);
    }
    expect(
      report.qualityGate.overallPassed,
      'All v1.5.1 release-quality thresholds must pass',
    ).toBe(true);

    const standardFontWarnings = standardFontWarningSpies
      .flatMap((spy) => spy.mock.calls)
      .map((args) => args.map(String).join(' '))
      .filter((message) => /standardFontDataUrl/i.test(message));
    expect(
      standardFontWarnings,
      'PDF.js benchmark extraction must not warn that standardFontDataUrl is missing',
    ).toEqual([]);
  });
});
