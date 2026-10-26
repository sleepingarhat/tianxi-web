import { createFileRoute } from "@tanstack/react-router";

// Public endpoint is always the guest projection; members use the authenticated-aware server function.
export const Route = createFileRoute("/api/public/freeze-ledger")({
  server: { handlers: { GET: async ({ request }) => {
    const url = new URL(request.url);
    const qs = new URLSearchParams();
    for (const key of ['dates', 'since']) {
      const value = url.searchParams.get(key);
      if (value && !/^\d{4}-\d{2}-\d{2}(,\d{4}-\d{2}-\d{2})*$/.test(value)) return Response.json({error:'日期格式無效'}, {status:400, headers:{'Cache-Control':'private, no-store'}});
      if (value) qs.set(key,value);
    }
    const headers = {'Cache-Control':'private, no-store'};
    try {
      const [{ workerFetch, WORKER_BASE }, { projectFreezeLedger }] = await Promise.all([
        import('@/lib/site-reader.server'), import('@/lib/reconciliation-projection'),
      ]);
      const res = await workerFetch(`${WORKER_BASE}/api/analyze/freeze-ledger?${qs}`, {cache:'no-store', signal:AbortSignal.timeout(15_000)});
      if (!res.ok) return Response.json({error:'凍結對帳暫未能讀取'}, {status:res.status, headers});
      const { viewerTier } = await import('@/lib/picks-entitlement.server');
      return Response.json(projectFreezeLedger(await res.json() as {meetings?:any[]}, await viewerTier()), {headers});
    } catch {
      return Response.json({error:'凍結對帳暫未能讀取'}, {status:502, headers});
    }
  } } },
});
