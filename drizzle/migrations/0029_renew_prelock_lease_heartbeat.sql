CREATE FUNCTION public.renew_racing_prelock(_date date, _token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.racing_prelock_state SET lease_until=now()+interval '120 seconds'
 WHERE race_date=_date AND lease_token=_token AND lease_until>now();
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.renew_racing_prelock(date,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.renew_racing_prelock(date,uuid) TO service_role;