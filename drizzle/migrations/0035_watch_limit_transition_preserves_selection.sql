CREATE TABLE public.watch_limit_state(user_id uuid PRIMARY KEY, applied_limit integer NOT NULL CHECK(applied_limit BETWEEN 1 AND 90), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.watch_limit_state TO authenticated;
GRANT ALL ON public.watch_limit_state TO service_role;
ALTER TABLE public.watch_limit_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY watch_limit_state_owner ON public.watch_limit_state FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE OR REPLACE FUNCTION public.apply_watch_limits(uid uuid, lim integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF lim<1 OR lim>90 THEN RAISE EXCEPTION 'Invalid watch limit'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,3323));
IF EXISTS(SELECT 1 FROM public.watch_limit_state WHERE user_id=uid AND applied_limit=lim) THEN RETURN; END IF;
WITH ranked AS(SELECT horse_id,row_number() OVER(ORDER BY paused ASC,activated_at DESC,created_at DESC,horse_id) AS n FROM public.horse_watchlist WHERE user_id=uid) UPDATE public.horse_watchlist w SET paused=(r.n>lim) FROM ranked r WHERE w.user_id=uid AND w.horse_id=r.horse_id AND w.paused IS DISTINCT FROM(r.n>lim);
INSERT INTO public.watch_limit_state(user_id,applied_limit) VALUES(uid,lim) ON CONFLICT(user_id) DO UPDATE SET applied_limit=excluded.applied_limit,updated_at=now();
END $$;
REVOKE ALL ON FUNCTION public.apply_watch_limits(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_watch_limits(uuid,integer) TO service_role;
CREATE FUNCTION public.cleanup_watch_notifications() RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n bigint; BEGIN DELETE FROM public.watch_notifications WHERE created_at<now()-interval '120 days';GET DIAGNOSTICS n=ROW_COUNT;RETURN n;END $$;
REVOKE ALL ON FUNCTION public.cleanup_watch_notifications() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_watch_notifications() TO service_role;