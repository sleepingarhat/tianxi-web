import { describe, expect, it } from 'vitest';
import { archiveCancellationEvidence } from './hkjc-cancellation-evidence.server';

// 驗證層測試：唔啱嘅輸入必須喺掂到資料庫之前被拒絕（fail-closed）。
describe('archiveCancellationEvidence 輸入守門', () => {
  it('拒絕非馬會官方來源', async () => {
    const r = await archiveCancellationEvidence({
      date: '2026-09-20',
      sourceUrl: 'https://example.com/fake',
      keyword: '停賽',
      sentence: 'x',
      rawHtml: '<html>x</html>',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('官方網站');
  });

  it('拒絕唔啱格式嘅日期', async () => {
    const r = await archiveCancellationEvidence({
      date: '20/09/2026',
      sourceUrl: 'https://racing.hkjc.com/x',
      keyword: '停賽',
      sentence: 'x',
      rawHtml: '<html>x</html>',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('日期');
  });

  it('拒絕缺原文或缺關鍵字', async () => {
    const noHtml = await archiveCancellationEvidence({
      date: '2026-09-20',
      sourceUrl: 'https://racing.hkjc.com/x',
      keyword: '停賽',
      sentence: 'x',
      rawHtml: '',
    });
    expect(noHtml.ok).toBe(false);
    const noKeyword = await archiveCancellationEvidence({
      date: '2026-09-20',
      sourceUrl: 'https://racing.hkjc.com/x',
      keyword: '',
      sentence: 'x',
      rawHtml: '<html>x</html>',
    });
    expect(noKeyword.ok).toBe(false);
  });
});
