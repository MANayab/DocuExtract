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
    try {
      if (typeof localStorage === 'undefined') return this.templates;
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return this.templates;
      this.templates = parseTemplateImport(raw);
    } catch {
      this.templates = [];
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Storage may be unavailable in private browsing or restricted contexts.
      }
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
    this.persist([...this.templates, template]);
    return template;
  }

  update(
    id: string,
    input: Omit<VendorTemplate, 'id' | 'createdAt' | 'updatedAt'>,
    consent: boolean,
  ) {
    if (!consent) {
      throw new Error('Explicit consent is required before updating a seller template.');
    }
    const previous = this.templates.find((template) => template.id === id);
    if (!previous) throw new Error('Seller template was not found.');
    const updated = vendorTemplateSchema.parse({
      ...input,
      id,
      schemaVersion: TEMPLATE_SCHEMA_VERSION,
      createdAt: previous.createdAt,
      updatedAt: new Date().toISOString(),
    });
    this.persist(this.templates.map((template) => (template.id === id ? updated : template)));
    return updated;
  }

  remove(id: string) {
    this.persist(this.templates.filter((template) => template.id !== id));
  }

  import(text: string, consent: boolean) {
    if (!consent) {
      throw new Error('Explicit consent is required before importing seller templates.');
    }
    const imported = parseTemplateImport(text);
    const known = new Set(this.templates.map((template) => template.id));
    const additions = imported.filter((template) => !known.has(template.id));
    this.persist([...this.templates, ...additions]);
    return additions.length;
  }

  export() {
    return JSON.stringify(
      { schemaVersion: TEMPLATE_SCHEMA_VERSION, templates: this.templates },
      null,
      2,
    );
  }

  private persist(nextTemplates: VendorTemplate[]) {
    const text = JSON.stringify(
      { schemaVersion: TEMPLATE_SCHEMA_VERSION, templates: nextTemplates },
      null,
      2,
    );
    if (new TextEncoder().encode(text).byteLength > TEMPLATE_EXPORT_MAX_BYTES) {
      throw new Error('Seller templates exceed the 256 KB storage limit.');
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, text);
    this.templates = nextTemplates;
  }
}
