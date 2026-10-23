import {hkDay} from './notification-rules';
export function undeliveredWatchRows<T extends {event_key:string}>(rows:T[],receipts:{event_key:string}[]){const sent=new Set(receipts.map(r=>r.event_key));return rows.filter(r=>!sent.has(r.event_key));}
export function watchPushDigest(rows:{id:string|number;title:string;event_type:string;created_at:string}[],now=Date.now()){
 if(!rows.length)return null;
 const ordered=[...rows].sort((a,b)=>String(a.id).localeCompare(String(b.id)));
 return {eventKey:'watch-digest:'+ordered.map(r=>r.id).join(':'),message:{title:rows.length===1?rows[0]?.title ?? '🐎 愛駒動態':`🐎 愛駒有 ${rows.length} 項新動態`,body:rows.slice(0,2).map(r=>r.title).join('；')+(rows.length>2?`；另有 ${rows.length-2} 項`:''),url:'/my-horses',tag:`watch-${hkDay(now)}`},ttl:rows.some(r=>r.event_type==='entry')?86400:21600};
}