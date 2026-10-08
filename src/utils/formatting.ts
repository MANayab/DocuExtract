export const money = (value:number,currency='') => `${currency ? currency+' ' : ''}${Number.isFinite(value)?value.toFixed(2):'—'}`;
export const confidenceBand=(n:number)=>n>=90?'HIGH':n>=70?'MEDIUM':'LOW';
