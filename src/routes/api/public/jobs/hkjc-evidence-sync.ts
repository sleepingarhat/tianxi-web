import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/jobs/hkjc-evidence-sync')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    try {
      const { syncHkjcEvidenceToRepository } = await import('@/lib/hkjc-evidence-repo.server');
      return Response.json(await syncHkjcEvidenceToRepository());
    } catch {
      const { sendTelegramAlert } = await import('@/lib/telegramAlert.server');
      await sendTelegramAlert('⚠️ 馬會更易原文同步資料倉失敗；原文仍保留，下一次安全重試，訓練不得使用未核實清單。').catch(() => null);
      return Response.json({ ok: false, error: '官方事件同步失敗，等待重試' }, { status: 502 });
    }
  } } },
});