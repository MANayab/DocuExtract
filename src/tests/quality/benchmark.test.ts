import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { invoicesToCsv, lineItemsToCsv } from '../../features/export/csvExporter';
import { invoicesToJson } from '../../features/export/jsonExporter';
import { invoicesToXlsx } from '../../features/export/xlsxExporter';
import { parseInvoice } from '../../features/extraction/invoiceParser';
import { splitInvoices } from '../../features/extraction/splitInvoices';
import { extractPdf } from '../../features/pdf/pdfTextExtractor';
import { validateInvoice } from '../../features/validation/invoiceValidator';
import { generateFixture, type FixtureKind } from '../fixtures/generateFixtures';
import manifest from './benchmark-fixtures.json';

type ExpectedLine = {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
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
  critical?: ExpectedFields;
  expectedError?: string;
};

const fixtures = manifest.fixtures as BenchmarkFixture[];
const outputDir = join(process.cwd(), 'output');

function equal(actual: unknown, expected: unknown) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

describe('offline extraction quality benchmark', () => {
  it('measures fixture accuracy and verifies local export generation', async () => {
    const report = {
      generatedAt: new Date().toISOString(),
      source: 'Repository-owned synthetic fixtures generated in-process',
      totalInvoicesProcessed: 0,
      fieldAccuracy: {} as Record<
        string,
        { correct: number; total: number; percentage: number }
      >,
      invoicesRequiringCorrection: 0,
      averageCorrectedFieldsPerInvoice: 0,
      extractionSuccessBySellerOrTemplate: {} as Record<
        string,
        { processed: number; reviewRequired: number }
      >,
      exportSuccess: {
        xlsx: 0,
        invoiceCsv: 0,
        lineItemsCsv: 0,
        json: 0,
        total: 0,
      },
      splitAccuracy: {
        expectedInvoices: 0,
        actualInvoices: 0,
        percentage: 0,
      },
      zeroErrorInvoices: 0,
      criticalFieldErrorInvoices: 0,
      fixtureResults: [] as Array<Record<string, unknown>>,
      limitations: [
        'Synthetic fixtures do not represent the full diversity of real supplier invoices.',
        'This initial baseline does not include scanned German or Hindi OCR fixtures.',
      ],
    };

    const fieldCounts = new Map<string, { correct: number; total: number }>();
    let correctedFields = 0;

    for (const fixture of fixtures) {
      const bytes = await generateFixture(fixture.kind as FixtureKind);
      const file = new File([bytes], `${fixture.id}.pdf`, {
        type: 'application/pdf',
      });

      if (fixture.expectedError) {
        let rejected = false;
        try {
          await extractPdf(file);
        } catch {
          rejected = true;
        }
        expect(rejected, `${fixture.id} should be rejected as malformed`).toBe(true);
        report.fixtureResults.push({
          id: fixture.id,
          rejectedAsExpected: true,
        });
        continue;
      }

      const raw = await extractPdf(file);
      const segments = splitInvoices(raw);
      const invoices = segments.map((segment) => parseInvoice(segment.raw));
      const invoice = invoices[0];
      expect(invoice, `${fixture.id} should produce an invoice review record`).toBeTruthy();

      const expected = fixture.critical!;
      const actual: ExpectedFields = {
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
        })),
      };

      const fieldResults: Record<string, boolean> = {};
      for (const [field, expectedValue] of Object.entries(expected)) {
        const actualValue = actual[field as keyof ExpectedFields];
        const matched = equal(actualValue, expectedValue);
        fieldResults[field] = matched;

        const count = fieldCounts.get(field) ?? {
          correct: 0,
          total: 0,
        };
        count.total += 1;
        if (matched) count.correct += 1;
        fieldCounts.set(field, count);
        if (!matched) correctedFields += 1;
      }

      const hasCriticalErrors = Object.values(fieldResults).some((matched) => !matched);
      if (hasCriticalErrors) {
        report.criticalFieldErrorInvoices += 1;
        report.invoicesRequiringCorrection += 1;
      } else {
        report.zeroErrorInvoices += 1;
      }

      const sellerKey = invoice.seller.name.value || fixture.id;
      const seller = report.extractionSuccessBySellerOrTemplate[sellerKey] ?? {
        processed: 0,
        reviewRequired: 0,
      };
      seller.processed += 1;
      if (hasCriticalErrors) seller.reviewRequired += 1;
      report.extractionSuccessBySellerOrTemplate[sellerKey] = seller;

      const entry = {
        invoice,
        checks: validateInvoice(invoice).checks,
      };
      const workbookBlob = await invoicesToXlsx([entry]);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await workbookBlob.arrayBuffer());
      expect(workbook.getWorksheet('Invoices')?.rowCount).toBeGreaterThan(1);
      report.exportSuccess.xlsx += 1;

      const invoiceCsv = await invoicesToCsv([entry]).text();
      expect(invoiceCsv).toContain('Invoice Number');
      report.exportSuccess.invoiceCsv += 1;

      const itemsCsv = await lineItemsToCsv([entry]).text();
      expect(itemsCsv).toContain('Description');
      report.exportSuccess.lineItemsCsv += 1;

      const json = JSON.parse(await invoicesToJson([entry]).text()) as {
        invoices: Array<{ invoice: unknown }>;
      };
      expect(json.invoices[0]?.invoice).toBeTruthy();
      report.exportSuccess.json += 1;

      report.totalInvoicesProcessed += invoices.length;
      report.splitAccuracy.expectedInvoices += 1;
      report.splitAccuracy.actualInvoices += invoices.length;
      report.fixtureResults.push({
        id: fixture.id,
        fieldResults,
        actualFields: actual,
        invoiceCount: invoices.length,
        validationValid: validateInvoice(invoice).valid,
        exportVerified: {
          xlsx: true,
          invoiceCsv: true,
          lineItemsCsv: true,
          json: true,
        },
      });
    }

    for (const [field, count] of fieldCounts) {
      report.fieldAccuracy[field] = {
        ...count,
        percentage: count.total
          ? Number(((count.correct / count.total) * 100).toFixed(2))
          : 0,
      };
    }

    const processed = report.totalInvoicesProcessed || 1;
    report.averageCorrectedFieldsPerInvoice = Number(
      (correctedFields / processed).toFixed(2),
    );
    report.exportSuccess.total =
      report.exportSuccess.xlsx +
      report.exportSuccess.invoiceCsv +
      report.exportSuccess.lineItemsCsv +
      report.exportSuccess.json;

    report.splitAccuracy.percentage = report.splitAccuracy.expectedInvoices
      ? Number(
          (
            (report.splitAccuracy.actualInvoices /
              report.splitAccuracy.expectedInvoices) *
            100
          ).toFixed(2),
        )
      : 0;

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(
      join(outputDir, 'benchmark-report.json'),
      JSON.stringify(report, null, 2),
    );

    const markdown = [
      '# DocuExtract extraction quality benchmark',
      '',
      `Generated: ${report.generatedAt}`,
      `Invoices processed: ${report.totalInvoicesProcessed}`,
      `Invoices requiring correction: ${report.invoicesRequiringCorrection}`,
      `Average corrected fields per invoice: ${report.averageCorrectedFieldsPerInvoice}`,
      `Zero-error invoices: ${report.zeroErrorInvoices}`,
      `Critical-field-error invoices: ${report.criticalFieldErrorInvoices}`,
      '',
      '| Critical field | Correct | Total | Accuracy |',
      '|---|---:|---:|---:|',
      ...Object.entries(report.fieldAccuracy).map(([field, value]) => {
        return `| ${field} | ${value.correct} | ${value.total} | ${value.percentage}% |`;
      }),
      '',
      `Export successes: ${report.exportSuccess.total}`,
      '',
      '## Limitations',
      ...report.limitations.map((item) => `- ${item}`),
    ].join('\n');

    writeFileSync(join(outputDir, 'benchmark-report.md'), markdown);

    expect(report.exportSuccess.xlsx).toBeGreaterThan(0);
    expect(report.exportSuccess.invoiceCsv).toBeGreaterThan(0);
    expect(report.exportSuccess.lineItemsCsv).toBeGreaterThan(0);
    expect(report.exportSuccess.json).toBeGreaterThan(0);
  });
});
