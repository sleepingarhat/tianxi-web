import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/track-record-summary')({
  server: { handlers: { GET: async () => {
    try {
      const { readTrackRecordSummary } = await import('@/lib/track-record-summary.server');
      return Response.json(await readTrackRecordSummary(), { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
    } catch {
      return Response.json({ ok: false, error: '戰績摘要暫未能更新，請稍後重試' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
  } } },
});