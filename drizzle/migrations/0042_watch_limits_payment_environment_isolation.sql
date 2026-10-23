CREATE OR REPLACE FUNCTION public.apply_watch_limits_all() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rec record; gate_at timestamptz:=public.membership_gate_at(); lim integer; setting_key text; is_pro boolean; sub record; env text:=coalesce((SELECT value#>>'{}' FROM public.app_settings WHERE key='membership_payment_environment'),'sandbox'); BEGIN
IF env NOT IN ('live','sandbox') THEN RAISE EXCEPTION 'Invalid payment environment'; END IF;
FOR rec IN SELECT DISTINCT w.user_id,ranks.r FROM public.horse_watchlist w LEFT JOIN (SELECT u.id,row_number() OVER(ORDER BY u.created_at,u.id) AS r FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) ranks ON ranks.id=w.user_id LOOP
IF gate_at IS NULL THEN setting_key:='watch_limit_free_stage';lim:=30; ELSE
SELECT status,current_period_end INTO sub FROM public.subscriptions WHERE user_id=rec.user_id AND environment=env ORDER BY created_at DESC,id DESC LIMIT 1;
is_pro:=false;
IF sub.status IN ('past_due','unpaid','incomplete','incomplete_expired','paused') THEN is_pro:=false;
ELSE
is_pro:=coalesce((sub.status IN ('active','trialing') AND (sub.current_period_end IS NULL OR sub.current_period_end>now())) OR (sub.status='canceled' AND sub.current_period_end>now()),false) OR coalesce(rec.r<=public.founding_cap() AND gate_at+interval '364 days'>now(),false) OR EXISTS(SELECT 1 FROM public.crypto_passes p WHERE p.user_id=rec.user_id AND p.environment=env AND p.status IN ('finished','manual_granted') AND p.valid_from<=now() AND p.valid_until>now());
END IF;
IF is_pro THEN setting_key:='watch_limit_pro';lim:=90;ELSE setting_key:='watch_limit_registered';lim:=3;END IF;END IF;
SELECT coalesce((SELECT (value#>>'{}')::integer FROM public.app_settings WHERE key=setting_key),lim) INTO lim;
PERFORM public.apply_watch_limits(rec.user_id,least(90,lim));END LOOP;END $$;
REVOKE ALL ON FUNCTION public.apply_watch_limits_all() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_watch_limits_all() TO service_role;