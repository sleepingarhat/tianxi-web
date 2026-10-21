CREATE TABLE public.racing_dividend_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), race_date date NOT NULL, venue text NOT NULL CHECK (venue IN ('ST','HV')),
 source_url text NOT NULL, source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[0-9a-f]{64}$'), raw_html text NOT NULL,
 dividends jsonb NOT NULL, trio_combinations jsonb NOT NULL, race_count integer NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (race_date,venue,source_sha256)
);
GRANT SELECT (race_date,venue,source_url,source_sha256,dividends,trio_combinations,race_count,fetched_at) ON public.racing_dividend_snapshots TO anon, authenticated;
GRANT SELECT, INSERT ON public.racing_dividend_snapshots TO service_role;
ALTER TABLE public.racing_dividend_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY dividend_public_read ON public.racing_dividend_snapshots FOR SELECT TO anon,authenticated USING (true);
CREATE INDEX racing_dividend_latest ON public.racing_dividend_snapshots (race_date, fetched_at DESC);