import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/public/racing-dividends')({
  server: { handlers: { GET: async ({ request }) => {
    const date = new URL(request.url).searchParams.get('date') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({error:'invalid-date'},{status:400});
    const { supabase } = await import('@/integrations/supabase/client');
    const result = await supabase.from('racing_dividend_snapshots').select('race_date,venue,dividends,trio_combinations,source_url,source_sha256,race_count,fetched_at').eq('race_date',date).order('fetched_at',{ascending:false}).limit(1).maybeSingle();
    if (result.error) return Response.json({error:'dividend-evidence-unavailable'},{status:502});
    return Response.json({evidence:result.data},{headers:{'cache-control':'public, max-age=30'}});
  } } },
});