import { z } from 'zod';

export const TEMPLATE_SCHEMA_VERSION = 1 as const;
export const TEMPLATE_EXPORT_MAX_BYTES = 256 * 1024;

const safeText = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[^<>\u0000]+$/, 'Template text cannot contain markup or control characters.');

const optionalSafeText = z
  .string()
  .trim()
  .max(160)
  .regex(/^[^<>\u0000]*$/, 'Template text cannot contain markup or control characters.')
  .optional();

export const templateFieldKeySchema = z.enum([
  'invoiceNumber',
  'invoiceDate',
  'dueDate',
  'currency',
  'seller.name',
  'seller.taxId',
  'buyer.name',
  'buyer.taxId',
  'subtotal',
  'taxTotal',
  'grandTotal',
]);

export const sellerMatcherSchema = z
  .object({
    gstin: optionalSafeText,
    nameKey: optionalSafeText,
  })
  .refine((value) => Boolean(value.gstin || value.nameKey), {
    message: 'Provide a seller GSTIN or seller name key.',
  });

export const vendorTemplateSchema = z.object({
  schemaVersion: z.literal(TEMPLATE_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9_-]{8,80}$/),
  name: safeText,
  seller: sellerMatcherSchema,
  fieldMappings: z
    .array(
      z.object({
        field: templateFieldKeySchema,
        labelAnchor: safeText,
      }),
    )
    .max(20),
  tableColumns: z
    .array(
      z.object({
        column: z.enum(['description', 'quantity', 'unitPrice', 'taxAmount', 'lineTotal']),
        headerAnchor: safeText,
      }),
    )
    .max(8),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const vendorTemplateExportSchema = z.object({
  schemaVersion: z.literal(TEMPLATE_SCHEMA_VERSION),
  templates: z.array(vendorTemplateSchema).max(100),
});

export type VendorTemplate = z.infer<typeof vendorTemplateSchema>;
export type VendorTemplateDraft = Omit<VendorTemplate, 'id' | 'createdAt' | 'updatedAt'>;

export function parseTemplateImport(text: string): VendorTemplate[] {
  if (new TextEncoder().encode(text).byteLength > TEMPLATE_EXPORT_MAX_BYTES) {
    throw new Error('Template import is larger than 256 KB.');
  }
  const value: unknown = JSON.parse(text);
  return vendorTemplateExportSchema.parse(value).templates;
}

export function makeTemplateId() {
  return `template_${crypto.randomUUID().replace(/-/g, '')}`;
}
