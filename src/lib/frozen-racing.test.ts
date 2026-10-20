import { describe, expect, it } from 'vitest';
import { validateFrozenSnapshot, frozenEvidenceStatus, frozenEvidenceCodeOf, FrozenEvidenceError } from './frozen-racing';
async function fixture() {
  const rows = Array.from({length:4},(_,i)=>({date:'2026-10-19',engine:'v12',variant:'baseline',race_number:1,horse_id:`horse_${i}`,horse_number:i+1,predicted_rank:i+1,final_score:1600-i,p_win:0.2,p_top3:null,factor_bonus:1,generated_at:'2026-10-19T00:48:21.522Z'}));
  const meta={date:'2026-10-19',config:'{}'};
  const snapshot_json=JSON.stringify({schema:1,date:'2026-10-19',engine:'v12',venue:'ST',lockAt:'2026-10-19T03:00:00Z',rows,meta});
  const sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(snapshot_json)))).map(n=>n.toString(16).padStart(2,'0')).join('');
  return {rows,meta,saved:{snapshot_json,sha256}};
}
describe('專用原始凍結只讀API驗證',()=>{
  it('全欄值相同才可讀回，NULL保持NULL',async()=>{
    const f=await fixture(); const s=await validateFrozenSnapshot(f.saved,'2026-10-19',f.rows,f.meta,Date.parse('2026-10-19T05:52:00Z'));
    expect(s.rows[0]?.final_score).toBe(1600);expect(s.rows[0]?.p_top3).toBeNull();
  });
  it('缺行拒絕，不能用其他預測補寫',async()=>{
    const f=await fixture();await expect(validateFrozenSnapshot(f.saved,'2026-10-19',f.rows.slice(1),f.meta)).rejects.toThrow('行數');
  });
  it('任何分數改變即拒絕',async()=>{
    const f=await fixture();await expect(validateFrozenSnapshot(f.saved,'2026-10-19',f.rows.map((r,i)=>i? r:{...r,final_score:1601}),f.meta)).rejects.toThrow('不一致');
  });
  it('NULL不能當零',async()=>{
    const f=await fixture();await expect(validateFrozenSnapshot(f.saved,'2026-10-19',f.rows.map(r=>({...r,p_top3:0})),f.meta)).rejects.toThrow('不一致');
  });
  it('指紋及鎖點前阻截',async()=>{
    const f=await fixture();await expect(validateFrozenSnapshot({...f.saved,sha256:'bad'},'2026-10-19',f.rows,f.meta)).rejects.toThrow('指紋');
    await expect(validateFrozenSnapshot(f.saved,'2026-10-19',f.rows,f.meta,Date.parse('2026-10-19T02:59:00Z'))).rejects.toThrow('鎖點');
  });
  it('描述不一致拒絕，同欄位不同JSON鍵序可以讀',async()=>{
    const f=await fixture();await expect(validateFrozenSnapshot(f.saved,'2026-10-19',f.rows,{config:'{}',date:'2026-10-19'})).resolves.toBeTruthy();
    await expect(validateFrozenSnapshot(f.saved,'2026-10-19',f.rows,{...f.meta,config:'changed'})).rejects.toThrow('描述');
  });
});
describe('凍結存證狀態分類（缺副本唔等於載入失敗）',()=>{
  it('無副本行係 no-archive，唔係核實失敗',()=>{
    expect(frozenEvidenceStatus(undefined)).toBe('no-archive');
    expect(frozenEvidenceStatus(null)).toBe('no-archive');
  });
  it('副本存在但 ok=0／ok=NULL 係 not-verified',()=>{
    expect(frozenEvidenceStatus({ok:0})).toBe('not-verified');
    expect(frozenEvidenceStatus({ok:null})).toBe('not-verified');
    expect(frozenEvidenceStatus({ok:1})).toBe('available');
  });
  it('只有明確抛出嘅存證錯誤先帶到原因碼，其他錯誤一律 verification-failed',()=>{
    expect(frozenEvidenceCodeOf(new FrozenEvidenceError('no-archive','呢個賽日未有已核實嘅原始凍結副本'))).toBe('no-archive');
    expect(frozenEvidenceCodeOf(new Error('fetch failed'))).toBe('verification-failed');
    expect(frozenEvidenceCodeOf(undefined)).toBe('verification-failed');
  });
});
