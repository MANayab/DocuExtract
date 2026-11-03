import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { generateFixture, type FixtureKind } from '../fixtures/generateFixtures';
import manifest from './benchmark-fixtures.json';
import { extractPdf } from '../../features/pdf/pdfTextExtractor';
import { splitInvoices } from '../../features/extraction/splitInvoices';
import { parseInvoice } from '../../features/extraction/invoiceParser';
import { invoicesToCsv, lineItemsToCsv } from '../../features/export/csvExporter';
import { invoicesToJson } from '../../features/export/jsonExporter';
import { invoicesToXlsx } from '../../features/export/xlsxExporter';
import { validateInvoice } from '../../features/validation/invoiceValidator';

type Expected = {
  invoiceNumber: string;
  invoiceDate: string;
  sellerName: string;
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  currency: string;
  lineItems: Array<{ description: string; quantity: number; rate: number; amount: number }>;
};
type Fixture = (typeof manifest.fixtures)[number] & { critical?: Expected; expectedError?: string };
const fixtures = manifest.fixtures as Fixture[];
const outputDir = join(process.cwd(), 'output');

const same = (actual: unknown, expected: unknown) =>
  JSON.stringify(actual) === JSON.stringify(expected);

describe('offline extraction quality benchmark', () => {
  it('measures fixture field accuracy and verifies local export generation', async () => {
    const report = {
      generatedAt: new Date().toISOString(),
      source: 'repository-owned synthetic fixtures generated in-process',
      totalInvoicesProcessed: 0,
      fieldAccuracy: {} as Record<string, { correct: number; total: number; percentage: number }>,
      invoicesRequiringCorrection: 0,
      averageCorrectedFieldsPerInvoice: 0,
      extractionSuccessBySellerOrTemplate: {} as Record<string, { processed: number; reviewRequired: number }>,
      exportSuccess: { xlsx: 0, invoiceCsv: 0, lineItemsCsv: 0, json: 0, total: 0 },
      splitAccuracy: { expectedInvoices: 0, actualInvoices: 0, percentage: 0 },
      zeroErrorInvoices: 0,
      criticalFieldErrorInvoices: 0,
      fixtureResults: [] as Array<Record<string, unknown>>,
      limitations: ['Synthetic fixtures do not represent the full diversity of real supplier invoices.'],
    };
    const counts = new Map<string, { correct: number; total: number }>();
    let correctedFields = 0;

    for (const fixture of fixtures) {
      const bytes = await generateFixture(fixture.kind as FixtureKind);
      const file = new File([bytes], `${fixture.id}.pdf`, { type: 'application/pdf' });
      if (fixture.expectedError) {
        let failed = false;
        try {
          await extractPdf(file);
        } catch {
          failed = true;
        }
        expect(failed, `${fixture.id} should be rejected as malformed`).toBe(true);
        report.fixtureResults.push({ id: fixture.id, rejectedAsExpected: true });
        continue;
      }

      const raw = await extractPdf(file);
      const segments = splitInvoices(raw);
      const invoices = segments.map((segment) => parseInvoice(segment.raw));
      const expected = fixture.critical!;
      const invoice = invoices[0];
      const actualFields: Record<string, unknown> = {
        invoiceNumber: invoice?.invoiceNumber.value ?? '',
        invoiceDate: invoice?.invoiceDate.value ?? '',
        sellerName: invoice?.seller.name.value ?? '',
        subtotal: invoice?.subtotal.value ?? 0,
        taxAmount: invoice?.taxTotal.value ?? 0,
        grandTotal: invoice?.grandTotal.value ?? 0,
        currency: invoice?.currency.value ?? '',
        lineItems: (invoice?.items ?? []).map((item) => ({
          description: item.description.value,
          quantity: item.quantity.value,
          rate: item.unitPrice.value,
          amount: item.lineTotal.value,
        })),
      };
      const fieldResults: Record<string, boolean> = {};
      for (const [field, expectedValue] of Object.entries(expected)) {
        const ok = same(actualFields[field], expectedValue);
        fieldResults[field] = ok;
        const count = counts.get(field) ?? { correct: 0, total: 0 };
        count.total += 1;
        if (ok) count.correct += 1;
        counts.set(field, count);
        if (!ok) correctedFields += 1;
      }
      const criticalErrors = Object.values(fieldResults).some((ok) => !ok);
      if (criticalErrors) report.criticalFieldErrorInvoices += 1;
      else report.zeroErrorInvoices += 1;
      if (criticalErrors || validateInvoice(invoice).checks.some((check) => check.status !== 'PASS')) {
        report.invoicesRequiringCorrection += 1;
      }
      const sellerKey = invoice.seller.name.value || fixture.id;
      const sellerResult = report.extractionSuccessBySellerOrTemplate[sellerKey] ?? { processed: 0, reviewRequired: 0 };
      sellerResult.processed += 1;
      if (criticalErrors) sellerResult.reviewRequired += 1;
      report.extractionSuccessBySellerOrTemplate[sellerKey] = sellerResult;

      const entry = { invoice, checks: validateInvoice(invoice).checks };
      const xlsx = await invoicesToXlsx([entry]);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(await xlsx.arrayBuffer());
      const parsedInvoiceSheet = workbook.getWorksheet('Invoices');
      expect(parsedInvoiceSheet?.rowCount).toBeGreaterThan(1);
      report.exportSuccess.xlsx += 1;

      const invoiceCsv = await invoicesToCsv([entry]).text();
      expect(invoiceCsv).toContain('Invoice Number');
      report.exportSuccess.invoiceCsv += 1;
      const itemCsv = await lineItemsToCsv([entry]).text();
      expect(itemCsv).toContain('Description');
      report.exportSuccess.lineItemsCsv += 1;

      const json = JSON.parse(await invoicesToJson([entry]).text()) as { invoices: Array<{ invoice: unknown }> };
      expect(json.invoices[0]?.invoice).toBeTruthy();
      report.exportSuccess.json += 1;
      report.totalInvoicesProcessed += invoices.length;
      report.splitAccuracy.expectedInvoices += fixture.id === 'multi-page' ? 1 : 1;
      report.splitAccuracy.actualInvoices += invoices.length;
      report.fixtureResults.push({
        id: fixture.id,
        fieldResults,
        actualFields,
        invoiceCount: invoices.length,
        validationStatus: validateInvoice(invoice).status,
        exportVerified: { xlsx: true, invoiceCsv: true, lineItemsCsv: true, json: true },
      });
    }

    for (const [field, count] of counts) {
      report.fieldAccuracy[field] = {
        ...count,
        percentage: count.total ? Number(((count.correct / count.total) * 100).toFixed(2)) : 0,
      };
    }
    const measuredInvoices = report.totalInvoicesProcessed || 1;
    report.averageCorrectedFieldsPerInvoice = Number((correctedFields / measuredInvoices).toFixed(2));
    report.exportSuccess.total = report.exportSuccess.xlsx + report.exportSuccess.invoiceCsv +
      report.exportSuccess.lineItemsCsv + report.exportSuccess.json;
    report.splitAccuracy.percentage = report.splitAccuracy.expectedInvoices
      ? Number(((report.splitAccuracy.actualInvoices / report.splitAccuracy.expectedInvoices) * 100).toFixed(2))
      : 0;

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, 'benchmark-report.json'), JSON.stringify(report, null, 2));
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
      ...Object.entries(report.fieldAccuracy).map(([field, value]) =>
        `| ${field} | ${value.correct} | ${value.total} | ${value.percentage}% |`),
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
