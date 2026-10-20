CREATE TABLE public.racing_change_updates (
 race_date date NOT NULL,
 revision text NOT NULL,
 phase text NOT NULL,
 requested_at timestamptz,
 recomputed_at timestamptz,
 generated_at timestamptz,
 checked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (race_date, revision)
);
GRANT SELECT ON public.racing_change_updates TO anon, authenticated;
GRANT ALL ON public.racing_change_updates TO service_role;
ALTER TABLE public.racing_change_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads change update progress" ON public.racing_change_updates FOR SELECT TO anon, authenticated USING (true);
CREATE FUNCTION public.project_racing_change_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(NEW.state->>'changeRevision','') NOT IN ('','[]') THEN
  INSERT INTO public.racing_change_updates(race_date,revision,phase,requested_at,recomputed_at,generated_at,checked_at)
  VALUES(NEW.race_date,NEW.state->>'changeRevision',coalesce(NEW.state->>'phase','pending'),nullif(NEW.state->>'requestedAt','')::timestamptz,nullif(NEW.state->>'recomputedAt','')::timestamptz,nullif(NEW.state->>'generatedAt','')::timestamptz,NEW.updated_at)
  ON CONFLICT(race_date,revision) DO UPDATE SET phase=excluded.phase,requested_at=excluded.requested_at,recomputed_at=excluded.recomputed_at,generated_at=excluded.generated_at,checked_at=excluded.checked_at;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.project_racing_change_update() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.project_racing_change_update() TO service_role;
CREATE TRIGGER project_racing_change_update AFTER INSERT OR UPDATE OF state ON public.racing_prelock_state FOR EACH ROW EXECUTE FUNCTION public.project_racing_change_update();