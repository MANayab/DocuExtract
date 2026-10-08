import { invoiceSchema } from '../../schemas/invoiceSchema'; import type { Invoice } from '../../types/invoice'; import { validateLineItems,validateTotals,type ValidationCheck } from './totalsValidator';
import { validateTax } from './taxValidator';
export function validateInvoice(i:Invoice):{valid:boolean;checks:ValidationCheck[];schemaErrors:string[]}{ const p=invoiceSchema.safeParse(i); const checks=[...validateLineItems(i),...validateTotals(i),...validateTax(i)]; return {valid:p.success&&checks.every(x=>x.status==='PASS'),checks,schemaErrors:p.success?[]:p.error.issues.map(x=>`${x.path.join('.')}: ${x.message}`)}; }

