import {
  TEMPLATE_EXPORT_MAX_BYTES,
  TEMPLATE_SCHEMA_VERSION,
  makeTemplateId,
  parseTemplateImport,
  vendorTemplateSchema,
  type VendorTemplate,
} from './templateSchema';

const STORAGE_KEY = 'docuextract.vendor-templates.v1';

export class TemplateStore {
  private templates: VendorTemplate[] = [];

  load(): VendorTemplate[] {
    if (typeof localStorage === 'undefined') return this.templates;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return this.templates;
    try {
      this.templates = parseTemplateImport(raw);
    } catch {
      this.templates = [];
    }
    return this.templates;
  }

  list() {
    return [...this.templates];
  }

  save(input: Omit<VendorTemplate, 'id' | 'createdAt' | 'updatedAt'>, consent: boolean) {
    if (!consent) throw new Error('Explicit consent is required before saving a seller template.');
    const now = new Date().toISOString();
    const template = vendorTemplateSchema.parse({
      ...input,
      id: makeTemplateId(),
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    });
    this.templates = [...this.templates, template];
    this.persist();
    return template;
  }

  update(id: string, input: Omit<VendorTemplate, 'id' | 'createdAt' | 'updatedAt'>) {
    const previous = this.templates.find((template) => template.id === id);
    if (!previous) throw new Error('Seller template was not found.');
    const updated = vendorTemplateSchema.parse({
      ...input,
      id,
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
    });
    this.templates = this.templates.map((template) => (template.id === id ? updated : template));
    this.persist();
    return updated;
  }

  remove(id: string) {
    this.templates = this.templates.filter((template) => template.id !== id);
    this.persist();
  }

  import(text: string) {
    const imported = parseTemplateImport(text);
    const known = new Set(this.templates.map((template) => template.id));
    this.templates = [...this.templates, ...imported.filter((template) => !known.has(template.id))];
    this.persist();
    return imported.length;
  }

  export() {
    return JSON.stringify(
      { schemaVersion: TEMPLATE_SCHEMA_VERSION, templates: this.templates },
      null,
      2,
    );
  }

  private persist() {
    if (typeof localStorage === 'undefined') return;
    const text = this.export();
    if (new TextEncoder().encode(text).byteLength > TEMPLATE_EXPORT_MAX_BYTES) {
      throw new Error('Seller templates exceed the 256 KB storage limit.');
    }
    localStorage.setItem(STORAGE_KEY, text);
  }
}
