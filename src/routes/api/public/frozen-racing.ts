import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

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
    } catch {
      return Response.json({date,edition:'unavailable',frozen:false,error:'原始凍結證據未能完整核實；沒有使用初版或臨場重算補寫'}, {status:503,headers});
    }
  } } },
});