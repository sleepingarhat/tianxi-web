CREATE TABLE public.racing_official_result_snapshots (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), race_date date NOT NULL, venue text NOT NULL CHECK (venue IN ('ST','HV')), race_number integer NOT NULL CHECK (race_number BETWEEN 1 AND 12), source_url text NOT NULL, source_sha256 text NOT NULL CHECK (source_sha256 ~ '^[a-f0-9]{64}$'), raw_html text NOT NULL, results jsonb NOT NULL CHECK (jsonb_typeof(results)='array'), fetched_at timestamptz NOT NULL DEFAULT now(), identity_verified boolean NOT NULL DEFAULT false, UNIQUE(race_date,venue,race_number,source_sha256)
);
GRANT SELECT, INSERT ON public.racing_official_result_snapshots TO service_role;
GRANT SELECT ON public.racing_official_result_snapshots TO anon, authenticated;
ALTER TABLE public.racing_official_result_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY verified_official_result_reads ON public.racing_official_result_snapshots FOR SELECT TO anon, authenticated USING (identity_verified);
CREATE TABLE public.racing_official_collection_leases (id text PRIMARY KEY, expires_at timestamptz NOT NULL);
GRANT SELECT, INSERT, UPDATE ON public.racing_official_collection_leases TO service_role;
ALTER TABLE public.racing_official_collection_leases ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.claim_official_collection_lease(lease_id text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE claimed text;
BEGIN
 INSERT INTO public.racing_official_collection_leases(id,expires_at) VALUES(lease_id,now()+interval '2 minutes') ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at WHERE racing_official_collection_leases.expires_at < now() RETURNING id INTO claimed;
 RETURN claimed IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION public.claim_official_collection_lease(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_official_collection_lease(text) TO service_role;