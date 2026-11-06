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
