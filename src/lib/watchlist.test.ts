import {describe,it,expect} from 'vitest';
import {enforceWatchRows,applyWatchLimitTransition,readPendingFollow,HORSE_ID,validHorseSearch,watchLimitMessage,type WatchRow} from './watchlist';
import {WATCH_LIMITS} from './freeStage';
import {projectLatestEvents} from './watch-events';
const rows=Array.from({length:12},(_,i)=>({horse_id:`horse_J${String(i).padStart(3,'0')}`,paused:false,activated_at:new Date(Date.UTC(2026,9,1,i)).toISOString(),created_at:new Date(Date.UTC(2026,9,1,i)).toISOString()} as WatchRow));
describe('愛駒規則',()=>{
 it('閘前30匹',()=>expect(WATCH_LIMITS.free_stage).toBe(30));
 it('免費會員3匹',()=>expect(WATCH_LIMITS.registered).toBe(3));
 it('Pro90匹',()=>expect(WATCH_LIMITS.pro).toBe(90));
 it('12匹開閘後保留最近3匹及9匹暫停，不刪紀錄',()=>{const r=enforceWatchRows(rows,3);expect(r).toHaveLength(12);expect(r.filter(v=>!v.paused).map(v=>v.horse_id)).toEqual(['horse_J011','horse_J010','horse_J009']);expect(r.filter(v=>v.paused)).toHaveLength(9);expect(rows.every(v=>!v.paused)).toBe(true);});
 it('同一上限重讀保留手動暫停，不自動重新啟用',()=>{const paused=rows.map(r=>({...r,paused:true}));expect(applyWatchLimitTransition(paused,30,30).every(r=>r.paused)).toBe(true);expect(applyWatchLimitTransition(paused,90,30).filter(r=>!r.paused)).toHaveLength(12);});
 it('升級後恢復暫停愛駒',()=>{expect(enforceWatchRows(enforceWatchRows(rows,3),90).filter(v=>!v.paused)).toHaveLength(12);});
 it('烙號身份只接受一或兩個英文字母及三個數字',()=>{expect(HORSE_ID.test('horse_J062')).toBe(true);expect(HORSE_ID.test('horse_PP062')).toBe(true);expect(HORSE_ID.test('horse_J62')).toBe(false);expect(HORSE_ID.test('J062')).toBe(false);});
 it('待追蹤24小時到期',()=>{const p=JSON.stringify({horseId:'horse_J062',horseName:'測試',ts:1000});expect(readPendingFollow(p,86400999)?.horseId).toBe('horse_J062');expect(readPendingFollow(p,86401000)).toBeNull();expect(readPendingFollow(p,999)).toBeNull();});
 it('中文一字可搜尋，英文至少兩字',()=>{expect(validHorseSearch('馬')).toBe(true);expect(validHorseSearch('J')).toBe(false);expect(validHorseSearch('J0')).toBe(true);});
 it('上限來自會籍設定而非客戶端',()=>{expect(watchLimitMessage(3,90,true,'registered')).toContain('3 匹');expect(watchLimitMessage(3,90,true,'registered')).toContain('90 匹');});
 it('僅投影允許愛駒最新動態',()=>{expect(projectLatestEvents({events:[{horse_id:'horse_J062',date:'2026-10-20',title:'晨操'},{horse_id:'horse_J062',date:'2026-10-21',title:'排位'},{horse_id:'horse_J063',date:'2026-10-21',title:'不可讀'}]},['horse_J062'])).toEqual({'horse_J062':{title:'排位',date:'2026-10-21'}});});
});
