import { describe, expect, it } from 'vitest';
import { validateFrozenSnapshot, frozenEvidenceStatus, frozenEvidenceCodeOf, frozenEvidenceHttpStatus, FrozenEvidenceError } from './frozen-racing';
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
  it('只有明確抛出嘅存證錯誤先帶到原因碼，其他錯誤（網絡／逾時／5xx）一律 read-failed',()=>{
    expect(frozenEvidenceCodeOf(new FrozenEvidenceError('no-archive','呢個賽日未有已核實嘅原始凍結副本'))).toBe('no-archive');
    expect(frozenEvidenceCodeOf(new FrozenEvidenceError('verification-failed','原始副本指紋不一致'))).toBe('verification-failed');
    expect(frozenEvidenceCodeOf(new Error('fetch failed'))).toBe('read-failed');
    expect(frozenEvidenceCodeOf(undefined)).toBe('read-failed');
  });
  it('狀態碼：無副本 404、讀取失敗 502／逾時 504、核實問題 503',()=>{
    expect(frozenEvidenceHttpStatus('no-archive')).toBe(404);
    expect(frozenEvidenceHttpStatus('read-failed',new Error('賽馬核對資料讀取失敗 [429]'))).toBe(502);
    const timeout=new Error('The operation timed out'); timeout.name='TimeoutError';
    expect(frozenEvidenceHttpStatus('read-failed',timeout)).toBe(504);
    expect(frozenEvidenceHttpStatus('verification-failed')).toBe(503);
    expect(frozenEvidenceHttpStatus('not-verified')).toBe(503);
  });
});
