import {describe,it,expect} from 'vitest';
import {watchPushDigest,undeliveredWatchRows} from './watch-digest';
const rows=[1,2,3].map(i=>({id:String(i),title:`馬${i} 出賽`,event_type:'trackwork',created_at:'2026-10-23T00:00:00Z'}));
describe('watch digest delivery',()=>{
 it('combines three events into one delivery envelope',()=>{const d=watchPushDigest(rows,Date.parse('2026-10-23T00:00:00Z'));expect(d?.message.body).toBe('馬1 出賽；馬2 出賽；另有 1 項');expect(d?.message.tag).toBe('watch-2026-10-23');});
 it('keeps receipt identity stable if order changes',()=>{expect(watchPushDigest(rows)?.eventKey).toBe(watchPushDigest([...rows].reverse())?.eventKey);});
 it('entry notifications last 24 hours',()=>{expect(watchPushDigest([{...rows[0],id:'1',title:'馬1',created_at:'2026-10-23',event_type:'entry'}])?.ttl).toBe(86400);});
 it('ordinary activity lasts six hours',()=>{expect(watchPushDigest(rows)?.ttl).toBe(21600);});
 it('empty rows send nothing',()=>{expect(watchPushDigest([])).toBeNull();});
 it('accepted device does not resend old events when a new event joins a retry',()=>{expect(undeliveredWatchRows([{event_key:'a'},{event_key:'b'},{event_key:'c'}],[{event_key:'a'},{event_key:'b'}])).toEqual([{event_key:'c'}]);});
 it('failed device retains all unaccepted events',()=>{expect(undeliveredWatchRows([{event_key:'a'},{event_key:'b'}],[])).toHaveLength(2);});
});