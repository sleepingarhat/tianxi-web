import { createFileRoute } from '@tanstack/react-router';
import { authenticateCronRequest } from '@/integrations/supabase/cron-auth';
import { z } from 'zod';
export const Route = createFileRoute('/api/public/jobs/billing-reminders')({
  server: { handlers: { POST: async ({ request }) => {
    const failure = await authenticateCronRequest(request);
    if (failure) return failure;
    const body = z.object({ kind: z.enum(['daily', 'test']) }).strict().safeParse(await request.json().catch(() => null));
    if (!body.success) return Response.json({ ok: false }, { status: 400 });
    try {
      const { checkBillingReminders } = await import('@/lib/billing-reminders.server');
      return Response.json(await checkBillingReminders(body.data.kind === 'test'));
    } catch (error) {
      console.error('billing-reminders', error instanceof Error ? error.message : 'unknown');
      return Response.json({ ok: false, error: '付款監察未完成，不能當作已付款或已通知' }, { status: 502 });
    }
  } } },
});
