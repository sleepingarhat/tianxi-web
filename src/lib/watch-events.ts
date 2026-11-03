export function projectLatestEvents(value: unknown, ids: string[]): Record<string,{title:string;date:string}> {
 const output:Record<string,{title:string;date:string}>={};
 const root=value && typeof value==='object'?value as Record<string,unknown>:{};
 const entries=Array.isArray(root['events'])?root['events']:[];
 for(const raw of entries){if(!raw||typeof raw!=='object')continue;const r=raw as Record<string,unknown>;const id=String(r['horse_id'] ?? r['horseId'] ?? '');const date=String(r['event_date'] ?? r['date'] ?? '');const title=String(r['title'] ?? ''); if(ids.includes(id) && title && /^\d{4}-\d{2}-\d{2}/.test(date) && (!output[id] || date>(output[id]?.date ?? '')))output[id]={title,date:date.slice(0,10)}; }return output;
}

export type FeedType='entry'|'trackwork'|'trial'|'injury';
export type FeedItem={type:FeedType;date:string;title:string;detail:string};
const FEED_TYPES:FeedType[]=['entry','trackwork','trial','injury'];
/** Per-horse, per-type latest events (max 5 each), newest first. Unknown types and malformed dates are dropped. */
export function projectHorseFeed(value: unknown, ids: string[], perType=5): Record<string,Record<FeedType,FeedItem[]>> {
 const out:Record<string,Record<FeedType,FeedItem[]>>={};
 for(const id of ids)out[id]={entry:[],trackwork:[],trial:[],injury:[]};
 const root=value && typeof value==='object'?value as Record<string,unknown>:{};
 const rows=Array.isArray(root['events'])?root['events']:[];
 const seen=new Set<string>();
 for(const raw of rows){if(!raw||typeof raw!=='object')continue;const r=raw as Record<string,unknown>;const id=String(r['horse_id'] ?? r['horseId'] ?? '');const type=String(r['type'] ?? '') as FeedType;const date=String(r['event_date'] ?? r['date'] ?? '');const title=String(r['title'] ?? '');
  const bucket=out[id];if(!bucket||!FEED_TYPES.includes(type)||!title||!/^\d{4}-\d{2}-\d{2}/.test(date))continue;
  const key=String(r['event_key'] ?? `${id}|${type}|${date}|${title}`);if(seen.has(key))continue;seen.add(key);
  bucket[type].push({type,date:date.slice(0,10),title,detail:feedDetail(type,(r['detail'] && typeof r['detail']==='object'?r['detail']:{}) as Record<string,unknown>)});}
 for(const id of ids){const b=out[id]!;for(const t of FEED_TYPES)b[t]=b[t].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,perType);}
 return out;
}
function feedDetail(type:FeedType,d:Record<string,unknown>){const t=(k:string)=>d[k]==null?'':String(d[k]);const venue=t('venue')==='ST'?'沙田':t('venue')==='HV'?'跑馬地':t('venue');
 const items=type==='entry'?[venue,t('raceNumber')&&`第${t('raceNumber')}場`,t('horseNumber')&&`${t('horseNumber')}號`,t('draw')&&`檔${t('draw')}`,t('jockey'),t('weight')&&`${t('weight')}磅`]:type==='trial'?[venue,t('distance')&&`${t('distance')}米`,t('position')&&`第${t('position')}名／${t('runners')||'—'}匹`,t('time'),t('comment')]:type==='injury'?[t('injuryType')]:[venue,t('track'),t('workType'),t('details')];
 return items.filter(Boolean).join(' · ');}
