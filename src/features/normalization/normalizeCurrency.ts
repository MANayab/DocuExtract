const symbols:Record<string,string>={'₹':'INR','$':'USD','€':'EUR','£':'GBP'};
export function normalizeCurrency(input:string):string { const s=input.trim(); for(const [k,v] of Object.entries(symbols)) if(s.includes(k)) return v; const m=s.match(/\b(INR|USD|EUR|GBP|AUD|CAD|AED|SAR|SGD)\b/i); return m?.[1].toUpperCase() ?? 'INR'; }
