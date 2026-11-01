import { describe, expect, it } from 'vitest';
import { emptyField, type Invoice } from '../../types/invoice';
import { matchVendorTemplate } from '../../features/templates/templateMatcher';
import type { VendorTemplate } from '../../features/templates/templateSchema';

const invoice = {
  seller: { name: emptyField('Acme Traders'), taxId: emptyField('29ABCDE1234F2Z5') },
} as unknown as Invoice;

const template = (seller: VendorTemplate['seller']): VendorTemplate => ({
  schemaVersion: 1,
  id: 'template_12345678',
  name: 'Acme',
  seller,
  fieldMappings: [],
  tableColumns: [],
  createdAt: '2026-11-02T00:00:00.000Z',
  updatedAt: '2026-11-02T00:00:00.000Z',
});

describe('seller template matcher', () => {
  it('matches exact GSTIN before seller-name keys', () => {
    expect(matchVendorTemplate(invoice, [template({ gstin: '29ABCDE1234F2Z5' })])?.name).toBe('Acme');
  });

  it('does not apply a similar but incorrect seller match', () => {
    expect(matchVendorTemplate(invoice, [template({ nameKey: 'Acme Traderz' })])).toBeUndefined();
  });
});
