CREATE TABLE public.track_record_summary_snapshot (
  key text PRIMARY KEY CHECK (key = 'current'),
  payload jsonb NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.track_record_summary_snapshot TO anon, authenticated;
GRANT ALL ON public.track_record_summary_snapshot TO service_role;
ALTER TABLE public.track_record_summary_snapshot ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read public record summary" ON public.track_record_summary_snapshot FOR SELECT TO anon, authenticated USING (key = 'current');
INSERT INTO public.track_record_summary_snapshot(key, payload, computed_at)
SELECT 'current', payload, computed_at FROM public.computed_cache
WHERE key = 'track-record-summary:v2' AND payload->>'schemaVersion' = '1'
AND payload->'market' ? '180' AND payload ? 'versions';
COMMENT ON TABLE public.track_record_summary_snapshot IS 'Complete public-derived summary only; scheduled publication, never frozen prediction rows.';