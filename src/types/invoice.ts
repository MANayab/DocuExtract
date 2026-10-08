export type ConfidenceBand = 'HIGH' | 'MEDIUM' | 'LOW';
export type SourceType = 'text' | 'ocr' | 'manual';
export interface ExtractedField<T> { value: T; confidence: number; source: SourceType; warning?: string; }
export interface Party { name: ExtractedField<string>; address: ExtractedField<string>; taxId: ExtractedField<string>; email: ExtractedField<string>; phone: ExtractedField<string>; }
export interface InvoiceItem { description: ExtractedField<string>; quantity: ExtractedField<number>; unit: ExtractedField<string>; unitPrice: ExtractedField<number>; discount: ExtractedField<number>; taxRate: ExtractedField<number>; taxAmount: ExtractedField<number>; lineTotal: ExtractedField<number>; }
export interface Invoice {
  invoiceNumber: ExtractedField<string>; invoiceDate: ExtractedField<string>; dueDate: ExtractedField<string>; currency: ExtractedField<string>;
  seller: Party; buyer: Party; items: InvoiceItem[];
  subtotal: ExtractedField<number>; discountTotal: ExtractedField<number>; taxTotal: ExtractedField<number>; shipping: ExtractedField<number>; otherCharges: ExtractedField<number>; grandTotal: ExtractedField<number>;
  payment: { method: ExtractedField<string>; reference: ExtractedField<string>; terms: ExtractedField<string> };
  extraction: { sourceType: SourceType; confidence: number; warnings: string[]; sourceFile: string; pageCount: number };
}
export const emptyField = <T,>(value: T, source: SourceType = 'manual'): ExtractedField<T> => ({ value, confidence: 0, source });
