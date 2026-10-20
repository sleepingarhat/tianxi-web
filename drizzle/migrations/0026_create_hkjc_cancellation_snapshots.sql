CREATE TABLE public.hkjc_cancellation_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_date date NOT NULL,
  source_url text NOT NULL,
  sha256 text NOT NULL,
  keyword text NOT NULL,
  sentence text NOT NULL,
  raw_html text NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (race_date, source_url, sha256)
);
GRANT SELECT ON public.hkjc_cancellation_snapshots TO anon;
GRANT SELECT ON public.hkjc_cancellation_snapshots TO authenticated;
GRANT ALL ON public.hkjc_cancellation_snapshots TO service_role;
ALTER TABLE public.hkjc_cancellation_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cancellation evidence"
  ON public.hkjc_cancellation_snapshots FOR SELECT TO anon, authenticated USING (true);