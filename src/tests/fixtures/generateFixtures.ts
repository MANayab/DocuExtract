import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
export type FixtureKind='basic'|'gst'|'multi-page'|'discount'|'missing-fields'|'malformed'|'empty';
const names={seller:'Fictional Meridian Supplies Pvt Ltd',buyer:'Imaginary Retail Works',gstin:'99ABCDE1234F1Z9'};
export async function generateFixture(kind:FixtureKind):Promise<Uint8Array>{
  if(kind==='malformed')return new TextEncoder().encode('%PDF-1.4\nthis is intentionally malformed');
  const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
  const add=(lines:string[])=>{const page=pdf.addPage([595,842]);let y=800;for(const line of lines){page.drawText(line,{x:48,y,size:12,font,color:rgb(0.1,0.1,0.1)});y-=24;}return page;};
  const common=[`INVOICE NO: INV-${kind.toUpperCase()}-001`,`Invoice Date: 17 Sep 2026`,`Seller: ${names.seller}`,`Buyer: ${names.buyer}`];
  if(kind==='empty'){pdf.addPage([595,842]);}
  else if(kind==='multi-page'){add([...common,'Description Quantity Unit Price Line Total','Consulting 2 500 1000']);add(['Continued invoice','Tax: 180','Grand Total: 1180']);}
  else if(kind==='gst'){add([...common,'Description Quantity Unit Price Tax Amount Line Total','Service 2 500 180 1180','Subtotal: 1000','CGST: 90','SGST: 90','Tax: 180','Grand Total: 1180']);}
  else if(kind==='discount'){add([...common,'Description Quantity Unit Price Discount Line Total','Item 2 500 100 900','Subtotal: 900','Discount: 100','Tax: 0','Grand Total: 800']);}
  else if(kind==='missing-fields'){add([`INVOICE NO: INV-MISSING-001`,'Description Quantity Unit Price Line Total','Item 1 100 100','Grand Total: 100']);}
  else add([...common,'Description Quantity Unit Price Line Total','Widget 2 500 1000','Subtotal: 1000','Tax: 180','Grand Total: 1180']);
  return pdf.save();
}
