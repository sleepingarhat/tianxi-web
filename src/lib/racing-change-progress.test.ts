import { describe, expect, it } from 'vitest';
import { changeRevision, progressForChange, verifiedUpdate, type ChangeProgress } from './racing-change-progress';
import type { HkjcChange } from './hkjc-changes';
const notice: HkjcChange={ raceNumber:8, horseNumber:2, horseName:'測試馬', kind:'scratched', replacement:null, text:'退出競賽', announcedAt:'21/10 10:00', announcedAtIso:'2026-10-21T02:00:00Z' };
const row: ChangeProgress={revision:changeRevision([notice]),phase:'clean',requested_at:null,recomputed_at:'2026-10-21T02:02:00Z',generated_at:'2026-10-21T02:01:00Z',checked_at:'2026-10-21T02:02:00Z'};
describe('公告重算證據',()=>{
  it('只配合同一場馬匹及原公告，不把其他公告的重算時間套入',()=>{
    expect(progressForChange(notice,[row])).toEqual(row);
    expect(progressForChange({...notice,raceNumber:9},[row])).toBeNull();
  });
  it('無重算時間或無預測生成時間不能稱完成',()=>{
    expect(verifiedUpdate(row)).toBe(true);
    expect(verifiedUpdate({...row,recomputed_at:null})).toBe(false);
    expect(verifiedUpdate({...row,generated_at:null})).toBe(false);
  });
  it('更新中即使有舊時間也不能稱完成',()=>expect(verifiedUpdate({...row,phase:'waiting-card'})).toBe(false));
});