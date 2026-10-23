export function projectLatestEvents(value: unknown, ids: string[]): Record<string,{title:string;date:string}> {
 const output:Record<string,{title:string;date:string}>={};
 const root=value && typeof value==='object'?value as Record<string,unknown>:{};
 const entries=Array.isArray(root['events'])?root['events']:[];
 for(const raw of entries){if(!raw||typeof raw!=='object')continue;const r=raw as Record<string,unknown>;const id=String(r['horse_id'] ?? r['horseId'] ?? '');const date=String(r['event_date'] ?? r['date'] ?? '');const title=String(r['title'] ?? ''); if(ids.includes(id) && title && /^\d{4}-\d{2}-\d{2}/.test(date) && (!output[id] || date>(output[id]?.date ?? '')))output[id]={title,date:date.slice(0,10)}; }return output;
}
