import {describe,it,expect} from 'vitest';
import {racedayIsLive,assertRacedayOptIn,shouldRecordRacedaySkip} from './notification-availability';
describe('賽日提示上線規則',()=>{
 it('預設關閉，即使有通知憑證仍不可登記',()=>expect(racedayIsLive(false,true,true)).toBe(false));
 it('設定開啟但沒有通知憑證仍不可登記',()=>expect(racedayIsLive(true,false,false)).toBe(false));
 it('設定開啟且VAPID可用才上線',()=>expect(racedayIsLive(true,true,false)).toBe(true));
 it('設定開啟且會員Bot可用才上線',()=>expect(racedayIsLive(true,false,true)).toBe(true));
 it('非boolean真值不會啟用',()=>expect(racedayIsLive('true',true,true)).toBe(false));
 it('伺服器拒絕未上線登記',()=>expect(()=>assertRacedayOptIn(true,false)).toThrow());
 it('未上線可取消提示',()=>expect(()=>assertRacedayOptIn(false,false)).not.toThrow());
 it('每日首次skip記錄',()=>expect(shouldRecordRacedaySkip(null,'not_final','2026-10-24')).toBe(true));
 it('同日相同skip不重複記錄',()=>expect(shouldRecordRacedaySkip({error:'not_final',created_at:'2026-10-24T00:00:00Z'},'not_final','2026-10-24')).toBe(false));
 it('狀態改變記錄一次',()=>expect(shouldRecordRacedaySkip({error:'not_final',created_at:'2026-10-24T00:00:00Z'},'unavailable','2026-10-24')).toBe(true));
 it('跨香港午夜記錄每日首次',()=>expect(shouldRecordRacedaySkip({error:'not_final',created_at:'2026-10-23T15:59:00Z'},'not_final','2026-10-24')).toBe(true));
});