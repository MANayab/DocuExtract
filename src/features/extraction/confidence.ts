import type { ExtractedField } from '../../types/invoice';
export function scoreField<T>(field:ExtractedField<T>, evidence:number):ExtractedField<T>{return {...field,confidence:Math.max(0,Math.min(100,evidence))};}
export function overallConfidence(values:number[]):number{return values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;}
