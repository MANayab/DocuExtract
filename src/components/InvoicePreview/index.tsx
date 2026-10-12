import type { ExtractedField, Invoice, Party } from '../../types/invoice';
import { confidenceBand } from '../../utils/formatting';

interface Props {
  invoice: Invoice;
  onChange: (invoice: Invoice) => void;
}

function Field<T extends string | number>({
  label,
  field,
  onChange,
  type = 'text',
  optional = false,
}: {
  label: string;
  field: ExtractedField<T>;
  onChange: (value: T) => void;
  type?: 'text' | 'number';
  /** Optional fields that are simply absent from the invoice are not alarming. */
  optional?: boolean;
}) {
  const band = confidenceBand(field.confidence);
  const edited = field.source === 'manual' && field.confidence > 0;
  const notFound = optional && (field.value === '' || field.value === 0) && band === 'LOW' && !field.warning;
  const tone = notFound ? 'empty' : band.toLowerCase();

  return (
    <label className={`dx-field dx-field--${tone}`}>
      <span className="dx-field__label">{label}</span>
      <input
        className="dx-input"
        type={type}
        step={type === 'number' ? 'any' : undefined}
        value={String(field.value)}
        onChange={(e) => onChange((type === 'number' ? Number(e.target.value) : e.target.value) as T)}
        aria-label={label}
      />
      <span className="dx-field__hint">
        {field.warning ??
          (notFound
            ? 'Not found on the invoice'
            : band === 'HIGH'
              ? edited
                ? 'Edited'
                : '\u00a0'
              : band === 'MEDIUM'
                ? 'Medium confidence'
                : 'Low confidence: please check')}
      </span>
    </label>
  );
}

function PartyFields({ title, party, onChange }: { title: string; party: Party; onChange: (p: Party) => void }) {
  const set = <K extends keyof Party>(key: K, value: Party[K]['value']) =>
    onChange({ ...party, [key]: { ...party[key], value, source: 'manual' } } as Party);

  return (
    <div>
      <h3 className="dx-subtitle">{title}</h3>
      <div className="dx-grid dx-grid--1">
        <Field label={`${title} name`} field={party.name} onChange={(v) => set('name', v)} />
        <Field optional label={`${title} address`} field={party.address} onChange={(v) => set('address', v)} />
        <Field optional label={`${title} tax ID`} field={party.taxId} onChange={(v) => set('taxId', v)} />
        <Field optional label={`${title} email`} field={party.email} onChange={(v) => set('email', v)} />
        <Field optional label={`${title} phone`} field={party.phone} onChange={(v) => set('phone', v)} />
      </div>
    </div>
  );
}

export function InvoicePreview({ invoice, onChange }: Props) {
  const set = <K extends keyof Invoice>(key: K, value: Invoice[K] extends ExtractedField<infer T> ? T : never) =>
    onChange({ ...invoice, [key]: { ...(invoice[key] as ExtractedField<unknown>), value, source: 'manual' } } as Invoice);

  const pay = (key: 'method' | 'reference' | 'terms', value: string) =>
    onChange({
      ...invoice,
      payment: { ...invoice.payment, [key]: { ...invoice.payment[key], value, source: 'manual' } } as Invoice['payment'],
    });

  return (
    <section className="dx-card" aria-labelledby="fields-title">
      <h2 id="fields-title">Review extracted fields</h2>
      <p className="dx-muted dx-small">Edit any value before export. Yellow marks medium confidence, amber marks low confidence.</p>

      <div className="dx-grid dx-grid--2 dx-mt">
        <Field label="Invoice number" field={invoice.invoiceNumber} onChange={(v) => set('invoiceNumber', v)} />
        <Field label="Invoice date" field={invoice.invoiceDate} onChange={(v) => set('invoiceDate', v)} />
        <Field optional label="Due date" field={invoice.dueDate} onChange={(v) => set('dueDate', v)} />
        <Field label="Currency" field={invoice.currency} onChange={(v) => set('currency', v)} />
        <Field label="Subtotal" field={invoice.subtotal} type="number" onChange={(v) => set('subtotal', v)} />
        <Field optional label="Discount total" field={invoice.discountTotal} type="number" onChange={(v) => set('discountTotal', v)} />
        <Field label="Tax total" field={invoice.taxTotal} type="number" onChange={(v) => set('taxTotal', v)} />
        <Field optional label="Shipping" field={invoice.shipping} type="number" onChange={(v) => set('shipping', v)} />
        <Field optional label="Other charges" field={invoice.otherCharges} type="number" onChange={(v) => set('otherCharges', v)} />
        <Field label="Grand total" field={invoice.grandTotal} type="number" onChange={(v) => set('grandTotal', v)} />
      </div>

      <div className="dx-grid dx-grid--2 dx-mt-lg">
        <PartyFields title="Seller" party={invoice.seller} onChange={(p) => onChange({ ...invoice, seller: p })} />
        <PartyFields title="Buyer" party={invoice.buyer} onChange={(p) => onChange({ ...invoice, buyer: p })} />
      </div>

      <h3 className="dx-subtitle dx-mt-lg">Payment</h3>
      <div className="dx-grid dx-grid--3">
        <Field optional label="Payment method" field={invoice.payment.method} onChange={(v) => pay('method', v)} />
        <Field optional label="Payment reference" field={invoice.payment.reference} onChange={(v) => pay('reference', v)} />
        <Field optional label="Payment terms" field={invoice.payment.terms} onChange={(v) => pay('terms', v)} />
      </div>
    </section>
  );
}
