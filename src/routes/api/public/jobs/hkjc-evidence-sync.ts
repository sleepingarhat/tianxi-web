import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';

export const Route = createFileRoute('/api/public/jobs/hkjc-evidence-sync')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    try {
      const { syncHkjcEvidenceToRepository } = await import('@/lib/hkjc-evidence-repo.server');
      const result = await syncHkjcEvidenceToRepository();
      const { reportHkjcEvidenceSyncSuccess } = await import('@/lib/telegramAlert.server');
      await reportHkjcEvidenceSyncSuccess().catch((err) => console.error('[hkjc-evidence-sync] recovery notify failed', err));
      return Response.json(result);
    } catch (error) {
      console.error('[hkjc-evidence-sync] failed', error);
      const { reportHkjcEvidenceSyncFailure } = await import('@/lib/telegramAlert.server');
      await reportHkjcEvidenceSyncFailure(error).catch((err) => console.error('[hkjc-evidence-sync] failure notify failed', err));
      return Response.json({ ok: false, error: '官方事件同步失敗，等待重試' }, { status: 502 });
    }
  } } },
});
