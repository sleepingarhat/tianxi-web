CREATE OR REPLACE FUNCTION public.apply_watch_limits(uid uuid, lim integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE paused_count integer:=0; BEGIN
IF lim IS NULL OR lim<1 OR lim>90 THEN RAISE EXCEPTION 'Invalid watch limit'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,3323));
IF EXISTS(SELECT 1 FROM public.watch_limit_state WHERE user_id=uid AND applied_limit=lim) THEN
 IF NOT EXISTS(SELECT 1 FROM public.horse_watchlist WHERE user_id=uid AND paused) THEN UPDATE public.watch_limit_state SET notice_pending_at=NULL WHERE user_id=uid; END IF;
 RETURN;
END IF;
WITH ranked AS(SELECT horse_id,row_number() OVER(ORDER BY paused ASC,activated_at DESC,created_at DESC,horse_id) AS n FROM public.horse_watchlist WHERE user_id=uid), changed AS(UPDATE public.horse_watchlist w SET paused=(r.n>lim) FROM ranked r WHERE w.user_id=uid AND w.horse_id=r.horse_id AND w.paused IS DISTINCT FROM(r.n>lim) RETURNING w.paused) SELECT count(*) INTO paused_count FROM changed WHERE paused=true;
INSERT INTO public.watch_limit_state(user_id,applied_limit,notice_pending_at) VALUES(uid,lim,CASE WHEN paused_count>0 THEN now() END) ON CONFLICT(user_id) DO UPDATE SET applied_limit=excluded.applied_limit,updated_at=now(),notice_pending_at=CASE WHEN paused_count>0 THEN now() ELSE NULL END;
END $$;
REVOKE ALL ON FUNCTION public.apply_watch_limits(uuid,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_watch_limits(uuid,integer) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_watch_limits_all() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rec record; gate_at timestamptz:=public.membership_gate_at(); lim integer; setting_key text; is_pro boolean; sub record; failed_subscription boolean; BEGIN
FOR rec IN SELECT DISTINCT w.user_id,ranks.r FROM public.horse_watchlist w LEFT JOIN (SELECT u.id,row_number() OVER(ORDER BY u.created_at,u.id) AS r FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) ranks ON ranks.id=w.user_id LOOP
 IF gate_at IS NULL THEN setting_key:='watch_limit_free_stage';lim:=30;
 ELSE
  is_pro:=false;failed_subscription:=false;
  FOR sub IN SELECT DISTINCT ON (environment) status,current_period_end,environment FROM public.subscriptions WHERE user_id=rec.user_id AND environment IN ('live','sandbox') ORDER BY environment,created_at DESC,id DESC LOOP
   IF sub.status IN ('past_due','unpaid','incomplete','incomplete_expired','paused') THEN failed_subscription:=true;
   ELSIF (sub.status IN ('active','trialing') AND (sub.current_period_end IS NULL OR sub.current_period_end>now())) OR (sub.status='canceled' AND sub.current_period_end>now()) THEN is_pro:=true; END IF;
  END LOOP;
  is_pro:=NOT failed_subscription AND (is_pro OR (rec.r<=public.founding_cap() AND gate_at+interval '364 days'>now()) OR public.crypto_pass_until(rec.user_id,'live')>now() OR public.crypto_pass_until(rec.user_id,'sandbox')>now() OR EXISTS(SELECT 1 FROM public.crypto_passes p WHERE p.user_id=rec.user_id AND p.environment IN ('live','sandbox') AND p.status IN ('finished','manual_granted') AND p.valid_from<=now() AND p.valid_until>now()));
  IF coalesce(is_pro,false) THEN setting_key:='watch_limit_pro';lim:=90; ELSE setting_key:='watch_limit_registered';lim:=3; END IF;
 END IF;
 SELECT coalesce((SELECT (value#>>'{}')::integer FROM public.app_settings WHERE key=setting_key),lim) INTO lim;
 PERFORM public.apply_watch_limits(rec.user_id,least(90,lim));
END LOOP; END $$;
REVOKE ALL ON FUNCTION public.apply_watch_limits_all() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_watch_limits_all() TO service_role;
ALTER POLICY settings_public_read ON public.app_settings USING(key IN ('paywall_threshold','watch_limit_free_stage','watch_limit_registered','watch_limit_pro','gate_open_at','founding_slots_locked','crypto_pass_enabled','crypto_pass_price_usd','raceday_alerts_enabled'));
CREATE OR REPLACE FUNCTION public.guard_membership_settings() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
IF TG_OP IN ('UPDATE','DELETE') AND OLD.key IN ('gate_open_at','founding_slots_locked') THEN RAISE EXCEPTION 'Membership gate and founding cap are immutable'; END IF;
IF TG_OP IN ('INSERT','UPDATE') THEN
IF NEW.key IN ('paywall_threshold','watch_limit_free_stage','watch_limit_registered','watch_limit_pro') AND (jsonb_typeof(NEW.value)<>'number' OR (NEW.value#>>'{}')!~'^[1-9][0-9]*$' OR (NEW.value#>>'{}')::numeric>100000) THEN RAISE EXCEPTION 'Invalid membership setting'; END IF;
IF NEW.key='raceday_alerts_enabled' AND jsonb_typeof(NEW.value)<>'boolean' THEN RAISE EXCEPTION 'Invalid raceday setting'; END IF;
NEW.updated_at:=now();RETURN NEW; END IF;RETURN OLD;END $$;