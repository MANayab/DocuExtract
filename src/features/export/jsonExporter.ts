import type { Invoice } from '../../types/invoice'; export function invoiceToJson(i:Invoice):Blob{return new Blob([JSON.stringify(i,null,2)],{type:'application/json;charset=utf-8'});}
