import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const getViewerFrozenRacing = createServerFn({ method: 'GET' })
  .inputValidator((data: { date: string }) => z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(data))
  .handler(async ({ data }) => {
    const { setResponseHeader } = await import('@tanstack/react-start/server');
    setResponseHeader('Cache-Control', 'private, no-store');
    const [{ readFrozenRacing }, { viewerTier }, { projectFrozenReconciliation }] = await Promise.all([
      import('./frozen-racing.server'), import('./picks-entitlement.server'), import('./reconciliation-projection'),
    ]);
    return projectFrozenReconciliation(await readFrozenRacing(data.date), await viewerTier());
  });

export const getViewerFreezeLedger = createServerFn({ method: 'GET' }).handler(async () => {
  const { setResponseHeader } = await import('@tanstack/react-start/server');
  setResponseHeader('Cache-Control', 'private, no-store');
  const [{ workerFetch, WORKER_BASE }, { viewerTier }, { projectFreezeLedger }] = await Promise.all([
    import('./site-reader.server'), import('./picks-entitlement.server'), import('./reconciliation-projection'),
  ]);
  const response = await workerFetch(`${WORKER_BASE}/api/analyze/freeze-ledger?since=2026-10-04`, { cache: 'no-store', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`凍結對帳暫未能讀取（${response.status}）`);
  return projectFreezeLedger(await response.json() as { meetings?: any[] }, await viewerTier());
});