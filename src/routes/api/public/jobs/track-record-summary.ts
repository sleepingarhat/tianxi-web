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
      const summary = await readTrackRecordSummary(true);
      const complete = Boolean(summary.versions && summary.market?.['180']);
      return Response.json({ ok: complete, generatedAt: summary.generatedAt, marketReady: Boolean(summary.market?.['180']), versionsReady: Boolean(summary.versions) }, { status: complete ? 200 : 502 });
    } catch { return Response.json({ ok: false, error: 'summary-refresh-failed' }, { status: 502 }); }
  } } },
});