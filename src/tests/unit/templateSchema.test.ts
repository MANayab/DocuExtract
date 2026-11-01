import { describe, expect, it } from 'vitest';
import { parseTemplateImport, TEMPLATE_SCHEMA_VERSION } from '../../features/templates/templateSchema';

describe('seller template schema', () => {
  it('accepts reading rules and rejects unsafe markup', () => {
    const json = JSON.stringify({
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      templates: [{
        schemaVersion: TEMPLATE_SCHEMA_VERSION,
        id: 'template_12345678',
        name: 'Acme rules',
        seller: { gstin: '29ABCDE1234F2Z5' },
        fieldMappings: [{ field: 'invoiceNumber', labelAnchor: 'Invoice No' }],
        tableColumns: [{ column: 'description', headerAnchor: 'Description' }],
        createdAt: '2026-11-02T00:00:00.000Z',
        updatedAt: '2026-11-02T00:00:00.000Z',
      }],
    });
    expect(parseTemplateImport(json)).toHaveLength(1);
    expect(() => parseTemplateImport(json.replace('Invoice No', '<script>'))).toThrow();
  });
});
