import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
export const Route = createFileRoute('/api/public/jobs/track-record-summary')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const body = await request.json().catch(() => null) as { kind?: unknown } | null;
    if (body?.kind !== 'refresh') return Response.json({ ok: false }, { status: 400 });
    try {
      const { readTrackRecordSummary } = await import('@/lib/track-record-summary.server');
      const summary = await readTrackRecordSummary();
      return Response.json({ ok: true, generatedAt: summary.generatedAt });
    } catch { return Response.json({ ok: false, error: 'summary-refresh-failed' }, { status: 502 }); }
  } } },
});