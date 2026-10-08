export function sanitizeCell(value:unknown):string|number|boolean|null { if(value===null||value===undefined)return null; if(typeof value==='number'||typeof value==='boolean')return value; const s=String(value); return /^[=+\-@\t\r]/.test(s)?`'${s}`:s; }
export const sanitizeRow=(row:unknown[]):(string|number|boolean|null)[]=>row.map(sanitizeCell);
