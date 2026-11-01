// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { TemplateStore } from '../../features/templates/templateStore';

const input = {
  schemaVersion: 1 as const,
  name: 'Acme rules',
  seller: { gstin: '29ABCDE1234F2Z5' },
  fieldMappings: [{ field: 'invoiceNumber' as const, labelAnchor: 'Invoice No' }],
  tableColumns: [{ column: 'description' as const, headerAnchor: 'Description' }],
};

afterEach(() => localStorage.clear());

describe('TemplateStore', () => {
  it('requires explicit consent before saving', () => {
    const store = new TemplateStore();
    expect(() => store.save(input, false)).toThrow('Explicit consent');
    expect(store.save(input, true).name).toBe('Acme rules');
  });

  it('round-trips validated browser-only template data', () => {
    const first = new TemplateStore();
    first.save(input, true);
    const exported = first.export();

    const second = new TemplateStore();
    expect(second.import(exported)).toBe(1);
    expect(second.list()).toHaveLength(1);
  });
});
