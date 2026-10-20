import { createFileRoute } from '@tanstack/react-router';

/** 只讀：邊個賽日有已核實嘅原始凍結副本（prediction_original_snapshots × recovery_status.ok=1）。 */
export const Route = createFileRoute('/api/public/frozen-archive-dates')({
  server: { handlers: { GET: async () => {
    const headers = { 'Cache-Control': 'no-store' };
    try {
      const { readVerifiedFrozenDates } = await import('@/lib/frozen-archive.server');
      return Response.json({ dates: await readVerifiedFrozenDates() }, { headers });
    } catch (error) {
      console.error('frozen-archive-dates read failed', error instanceof Error ? error.message : 'unknown');
      return Response.json({ dates: [], error: '凍結存證目錄暫時未能讀取' }, { status: 503, headers });
    }
  } } },
});
