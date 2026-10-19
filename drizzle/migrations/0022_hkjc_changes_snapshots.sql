CREATE TABLE public.hkjc_changes_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_date date NOT NULL,
  venue text NOT NULL CHECK (venue IN ('ST','HV')),
  fetched_at timestamptz NOT NULL DEFAULT now(),
  source_url text NOT NULL,
  sha256 text NOT NULL,
  changes jsonb NOT NULL DEFAULT '[]'::jsonb,
  raw_html text NOT NULL,
  UNIQUE (race_date, venue, sha256)
);
GRANT SELECT ON public.hkjc_changes_snapshots TO anon, authenticated;
GRANT ALL ON public.hkjc_changes_snapshots TO service_role;
ALTER TABLE public.hkjc_changes_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read official HKJC change snapshots" ON public.hkjc_changes_snapshots FOR SELECT TO anon, authenticated USING (true);
CREATE INDEX hkjc_changes_snapshots_date_idx ON public.hkjc_changes_snapshots (race_date, fetched_at DESC);