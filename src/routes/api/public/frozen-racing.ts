import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { frozenEvidenceCodeOf, type FrozenEvidenceCode } from '@/lib/frozen-racing';

/** 三種缺證情況要分開講，會員先知道係「無存證」定「核實失敗」。 */
const EVIDENCE_ZH: Record<FrozenEvidenceCode, string> = {
  available: '',
  'no-archive': '呢個賽日未有已核實嘅原始凍結副本，故唔會展示最終預測；唔會以初版或臨場重算補寫。由19/10/2026賽事日起，系統會就賽前／賽後變更自動重算並喺鎖點建立凍結副本，呢啲賽日可以逐場核對原注。',
  'not-verified': '呢個賽日虽然有副本，但核實狀態未確認，暫停展示最終預測。',
  'verification-failed': '原始凍結證據未能完整核實；沒有使用初版或臨場重算補寫。',
};

export const Route = createFileRoute('/api/public/frozen-racing')({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url);
    const date = url.searchParams.get('date') ?? new Date(Date.now()+8*3600_000).toISOString().slice(0,10);
    const valid = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v).safeParse(date);
    const headers = { 'Cache-Control':'no-store' };
    if (!valid.success) return Response.json({edition:'unavailable',error:'賽日日期無效'}, {status:400,headers});
    try {
      const { readFrozenRacing } = await import('@/lib/frozen-racing.server');
      return Response.json(await readFrozenRacing(valid.data),{headers});
    } catch (error) {
      const reason = frozenEvidenceCodeOf(error);
      console.error('frozen-racing verification failed', reason, error instanceof Error ? error.message : 'unknown');
      return Response.json({date,edition:'unavailable',frozen:false,reason,error:EVIDENCE_ZH[reason] || EVIDENCE_ZH['verification-failed']}, {status:503,headers});
    }
  } } },
});