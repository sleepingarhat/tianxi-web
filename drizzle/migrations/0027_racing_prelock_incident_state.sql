CREATE TABLE public.racing_prelock_state (
 race_date date PRIMARY KEY,
 state jsonb NOT NULL DEFAULT '{}'::jsonb,
 lease_token uuid,
 lease_until timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.racing_prelock_state TO service_role;
ALTER TABLE public.racing_prelock_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read prelock incidents" ON public.racing_prelock_state FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
GRANT SELECT ON public.racing_prelock_state TO authenticated;
CREATE FUNCTION public.claim_racing_prelock(_date date, _token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE current_state jsonb;
BEGIN
 INSERT INTO public.racing_prelock_state(race_date,lease_token,lease_until) VALUES(_date,_token,now()+interval '120 seconds')
 ON CONFLICT(race_date) DO UPDATE SET lease_token=_token,lease_until=now()+interval '120 seconds'
 WHERE racing_prelock_state.lease_until IS NULL OR racing_prelock_state.lease_until < now()
 RETURNING state INTO current_state;
 RETURN current_state;
END $$;
CREATE FUNCTION public.save_racing_prelock(_date date, _token uuid, _state jsonb, _release boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.racing_prelock_state SET state=_state,updated_at=now(),lease_until=CASE WHEN _release THEN NULL ELSE lease_until END,lease_token=CASE WHEN _release THEN NULL ELSE lease_token END
 WHERE race_date=_date AND lease_token=_token AND lease_until>now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.claim_racing_prelock(date,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.save_racing_prelock(date,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_racing_prelock(date,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.save_racing_prelock(date,uuid,jsonb,boolean) TO service_role;