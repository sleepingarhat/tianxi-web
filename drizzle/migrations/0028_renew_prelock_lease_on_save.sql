CREATE OR REPLACE FUNCTION public.save_racing_prelock(_date date, _token uuid, _state jsonb, _release boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.racing_prelock_state SET state=_state,updated_at=now(),
  lease_until=CASE WHEN _release THEN NULL ELSE now()+interval '120 seconds' END,
  lease_token=CASE WHEN _release THEN NULL ELSE lease_token END
 WHERE race_date=_date AND lease_token=_token AND lease_until>now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.save_racing_prelock(date,uuid,jsonb,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_racing_prelock(date,uuid,jsonb,boolean) TO service_role;