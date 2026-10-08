import { describe, expect, it } from 'vitest';
import type { Invoice } from '../../types/invoice';
import { validateInvoice } from '../../features/validation/invoiceValidator';

const base = (): Invoice => ({
  invoiceNumber: {
    value: 'INV-001',
    confidence: 100,
    source: 'manual',
  },
  invoiceDate: {
    value: '2026-09-18',
    confidence: 100,
    source: 'manual',
  },
  dueDate: {
    value: '2026-09-25',
    confidence: 100,
    source: 'manual',
  },
  currency: {
    value: 'INR',
    confidence: 100,
    source: 'manual',
  },
  seller: {
    name: {
      value: 'Nayab Technologies',
      confidence: 100,
      source: 'manual',
    },
    address: {
      value: 'Hyderabad, Telangana, India',
      confidence: 100,
      source: 'manual',
    },
    taxId: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
    email: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
    phone: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
  },
  buyer: {
    name: {
      value: 'Example Buyer',
      confidence: 100,
      source: 'manual',
    },
    address: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
    taxId: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
    email: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
    phone: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
  },
  items: [
    {
      description: {
        value: 'Product A',
        confidence: 100,
        source: 'manual',
      },
      quantity: {
        value: 1,
        confidence: 100,
        source: 'manual',
      },
      unit: {
        value: 'pcs',
        confidence: 100,
        source: 'manual',
      },
      unitPrice: {
        value: 100,
        confidence: 100,
        source: 'manual',
      },
      discount: {
        value: 0,
        confidence: 100,
        source: 'manual',
      },
      taxRate: {
        value: 0,
        confidence: 100,
        source: 'manual',
      },
      taxAmount: {
        value: 0,
        confidence: 100,
        source: 'manual',
      },
      lineTotal: {
        value: 100,
        confidence: 100,
        source: 'manual',
      },
    },
  ],
  subtotal: {
    value: 100,
    confidence: 100,
    source: 'manual',
  },
  discountTotal: {
    value: 0,
    confidence: 100,
    source: 'manual',
  },
  taxTotal: {
    value: 0,
    confidence: 100,
    source: 'manual',
  },
  shipping: {
    value: 0,
    confidence: 100,
    source: 'manual',
  },
  otherCharges: {
    value: 0,
    confidence: 100,
    source: 'manual',
  },
  grandTotal: {
    value: 100,
    confidence: 100,
    source: 'manual',
  },
  payment: {
    method: {
      value: 'Bank Transfer',
      confidence: 100,
      source: 'manual',
    },
    reference: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
    terms: {
      value: '',
      confidence: 0,
      source: 'manual',
    },
  },
  extraction: {
    sourceType: 'text',
    confidence: 100,
    warnings: [],
    sourceFile: 'test.pdf',
    pageCount: 1,
  },
});

describe('validation', () => {
  it('passes reconciled invoice', () => {
    expect(validateInvoice(base()).valid).toBe(true);
  });

  it('fails arithmetic mismatch', () => {
    const invoice = base();

    invoice.grandTotal.value = 99;

    expect(validateInvoice(invoice).valid).toBe(false);
  });
});