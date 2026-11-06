// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { TemplateStore } from '../../features/templates/templateStore';

const input = {
  schemaVersion: 1 as const,
  name: 'Acme rules',
  seller: { nameKey: 'Acme Traders' },
  fieldMappings: [{ field: 'invoiceNumber' as const, labelAnchor: 'Invoice No' }],
  tableColumns: [{ column: 'description' as const, headerAnchor: 'Description' }],
};

afterEach(() => localStorage.clear());

describe('TemplateStore', () => {
  it('requires explicit consent before saving', () => {
    const store = new TemplateStore();
    expect(() => store.save(input, false)).toThrow('Explicit consent');
    expect(localStorage.getItem('docuextract.vendor-templates.v1')).toBeNull();
    expect(store.save(input, true).name).toBe('Acme rules');
  });

  it('requires consent to update and removes invalid legacy profile data', () => {
    const store = new TemplateStore();
    const saved = store.save(input, true);
    expect(() => store.update(saved.id, input, false)).toThrow('Explicit consent');
    expect(store.update(saved.id, input, true).seller.nameKey).toBe('Acme Traders');

    localStorage.setItem(
      'docuextract.vendor-templates.v1',
      JSON.stringify({
        schemaVersion: 1,
        templates: [{ ...saved, seller: { gstin: '29ABCDE1234F2Z5' } }],
      }),
    );
    expect(new TemplateStore().load()).toHaveLength(0);
    expect(localStorage.getItem('docuextract.vendor-templates.v1')).toBeNull();
  });

  it('updates and deletes only the consented seller matching profile', () => {
    const store = new TemplateStore();
    const saved = store.save(input, true);
    const updated = store.update(
      saved.id,
      {
        ...input,
        name: 'Updated Acme profile',
        seller: { nameKey: 'Updated Acme Traders' },
      },
      true,
    );

    expect(updated.name).toBe('Updated Acme profile');
    expect(updated.seller.nameKey).toBe('Updated Acme Traders');
    const persisted = localStorage.getItem('docuextract.vendor-templates.v1') ?? '';
    expect(persisted).toContain('Updated Acme Traders');
    expect(persisted).not.toContain('PRIVACY-INV-DO-NOT-PERSIST-001');

    store.remove(saved.id);
    expect(store.list()).toHaveLength(0);
    expect(
      JSON.parse(localStorage.getItem('docuextract.vendor-templates.v1') ?? '{}').templates,
    ).toEqual([]);
  });

  it('round-trips validated browser-only template data', () => {
    const first = new TemplateStore();
    first.save(input, true);
    const exported = first.export();

    const second = new TemplateStore();
    expect(() => second.import(exported, false)).toThrow('Explicit consent');
    expect(second.list()).toHaveLength(0);
    expect(second.import(exported, true)).toBe(1);
    expect(second.list()).toHaveLength(1);
  });
});
