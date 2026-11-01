import type { Invoice } from '../../types/invoice';
import type { VendorTemplate } from './templateSchema';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function matchVendorTemplate(
  invoice: Invoice,
  templates: readonly VendorTemplate[],
): VendorTemplate | undefined {
  const gstin = normalize(String(invoice.seller.taxId.value ?? ''));
  const sellerName = normalize(String(invoice.seller.name.value ?? ''));

  const exactGstin = templates.find(
    (template) =>
      template.seller.gstin &&
      gstin &&
      normalize(template.seller.gstin) === gstin,
  );
  if (exactGstin) return exactGstin;

  return templates.find(
    (template) =>
      template.seller.nameKey &&
      sellerName &&
      normalize(template.seller.nameKey) === sellerName,
  );
}

export function anchorsMatch(invoice: Invoice, template: VendorTemplate): boolean {
  const haystack = [
    invoice.seller.name.value,
    invoice.seller.taxId.value,
    invoice.invoiceNumber.value,
    invoice.invoiceDate.value,
    invoice.grandTotal.value,
  ]
    .map((value) => String(value).toLowerCase())
    .join('\n');

  return template.fieldMappings.every((mapping) =>
    haystack.includes(mapping.labelAnchor.toLowerCase()),
  );
}
