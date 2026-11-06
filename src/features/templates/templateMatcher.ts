import type { Invoice } from '../../types/invoice';
import type { VendorTemplate } from './templateSchema';

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

export function matchVendorTemplate(
  invoice: Invoice,
  templates: readonly VendorTemplate[],
): VendorTemplate | undefined {
  const sellerName = normalize(String(invoice.seller.name.value ?? ''));

  return templates.find(
    (template) =>
      Boolean(template.seller.nameKey) &&
      Boolean(sellerName) &&
      normalize(template.seller.nameKey ?? '') === sellerName,
  );
}

/**
 * Kept as a conservative label-presence check for template diagnostics.
 * A match does not itself apply extraction rules; parser integration remains
 * a separate, explicitly documented limitation.
 */
export function anchorsMatch(invoice: Invoice, template: VendorTemplate): boolean {
  const haystack = [invoice.seller.name.value]
    .map((value) => String(value).toLowerCase())
    .join('\\n');

  return (
    template.fieldMappings.length > 0 &&
    template.fieldMappings.every((mapping) =>
      haystack.includes(mapping.labelAnchor.toLowerCase()),
    )
  );
}
