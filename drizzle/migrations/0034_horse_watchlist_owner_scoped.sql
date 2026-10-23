CREATE TABLE public.horse_watchlist (user_id uuid NOT NULL, horse_id text NOT NULL CHECK (horse_id ~ '^horse_[A-Z]{1,2}[0-9]{3}$'), horse_name text, notify_entry boolean NOT NULL DEFAULT true, notify_trackwork boolean NOT NULL DEFAULT true, notify_trial boolean NOT NULL DEFAULT true, notify_injury boolean NOT NULL DEFAULT true, notify_push boolean NOT NULL DEFAULT true, notify_telegram boolean NOT NULL DEFAULT true, paused boolean NOT NULL DEFAULT false, activated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,horse_id));
GRANT SELECT, DELETE ON public.horse_watchlist TO authenticated;
GRANT UPDATE(notify_entry,notify_trackwork,notify_trial,notify_injury,notify_push,notify_telegram) ON public.horse_watchlist TO authenticated;
GRANT ALL ON public.horse_watchlist TO service_role;
ALTER TABLE public.horse_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY watch_owner_read ON public.horse_watchlist FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY watch_owner_delete ON public.horse_watchlist FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE POLICY watch_owner_settings ON public.horse_watchlist FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX horse_watchlist_horse_idx ON public.horse_watchlist(horse_id);
CREATE TABLE public.notification_prefs (user_id uuid PRIMARY KEY, telegram_enabled boolean NOT NULL DEFAULT false, push_enabled boolean NOT NULL DEFAULT false, trackwork_mode text NOT NULL DEFAULT 'gallop' CHECK(trackwork_mode IN ('gallop','all')), raceday_alerts boolean NOT NULL DEFAULT true, updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,UPDATE,DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;
ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY prefs_owner ON public.notification_prefs FOR ALL TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE TABLE public.watch_notifications (id bigserial PRIMARY KEY, user_id uuid NOT NULL, horse_id text, event_key text NOT NULL, event_type text NOT NULL CHECK(event_type IN ('entry','trackwork','trial','injury','raceday')), event_date date, title text NOT NULL, payload jsonb NOT NULL DEFAULT '{}', telegram_sent_at timestamptz, push_sent_at timestamptz, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,event_key));
GRANT SELECT ON public.watch_notifications TO authenticated;
GRANT UPDATE(read_at) ON public.watch_notifications TO authenticated;
GRANT ALL ON public.watch_notifications TO service_role;
GRANT USAGE,SELECT ON SEQUENCE public.watch_notifications_id_seq TO service_role;
ALTER TABLE public.watch_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_owner_read ON public.watch_notifications FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY notifications_owner_mark ON public.watch_notifications FOR UPDATE TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
CREATE INDEX watch_notifications_owner_date_idx ON public.watch_notifications(user_id,created_at DESC);
CREATE FUNCTION public.guard_watch_hard_cap() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(NEW.user_id::text,3323));
IF NOT EXISTS(SELECT 1 FROM public.horse_watchlist WHERE user_id=NEW.user_id AND horse_id=NEW.horse_id) AND (SELECT count(*) FROM public.horse_watchlist WHERE user_id=NEW.user_id)>=90 THEN RAISE EXCEPTION '追蹤數目已達上限'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER watch_hard_cap BEFORE INSERT ON public.horse_watchlist FOR EACH ROW EXECUTE FUNCTION public.guard_watch_hard_cap();
CREATE FUNCTION public.apply_watch_limits(uid uuid, lim integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF lim < 1 OR lim > 90 THEN RAISE EXCEPTION 'Invalid watch limit'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,3323));
WITH ranked AS (SELECT horse_id,row_number() OVER(ORDER BY paused ASC, activated_at DESC,created_at DESC,horse_id) AS n FROM public.horse_watchlist WHERE user_id=uid) UPDATE public.horse_watchlist w SET paused=(r.n>lim) FROM ranked r WHERE w.user_id=uid AND w.horse_id=r.horse_id AND w.paused IS DISTINCT FROM (r.n>lim);
END $$;
REVOKE ALL ON FUNCTION public.apply_watch_limits(uuid,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_watch_limits(uuid,integer) TO service_role;
CREATE FUNCTION public.mutate_horse_watch(uid uuid, lim integer, action text, hid text, hname text DEFAULT NULL, active boolean DEFAULT true, swap_id text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE current_active integer; BEGIN
IF lim < 1 OR lim > 90 OR hid !~ '^horse_[A-Z]{1,2}[0-9]{3}$' THEN RAISE EXCEPTION 'Invalid watch input'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,3323));
PERFORM public.apply_watch_limits(uid,lim);
IF action='remove' THEN DELETE FROM public.horse_watchlist WHERE user_id=uid AND horse_id=hid; RETURN; END IF;
IF action='add' AND EXISTS(SELECT 1 FROM public.horse_watchlist WHERE user_id=uid AND horse_id=hid) THEN RETURN; END IF;
IF action='active' AND NOT EXISTS(SELECT 1 FROM public.horse_watchlist WHERE user_id=uid AND horse_id=hid) THEN RAISE EXCEPTION 'Watch not found'; END IF;
IF action='active' AND NOT active THEN UPDATE public.horse_watchlist SET paused=true WHERE user_id=uid AND horse_id=hid; RETURN; END IF;
IF action NOT IN ('add','active') THEN RAISE EXCEPTION 'Invalid watch action'; END IF;
IF action='active' AND EXISTS(SELECT 1 FROM public.horse_watchlist WHERE user_id=uid AND horse_id=hid AND NOT paused) THEN RETURN; END IF;
SELECT count(*) INTO current_active FROM public.horse_watchlist WHERE user_id=uid AND NOT paused;
IF current_active>=lim THEN
IF swap_id IS NULL OR swap_id=hid OR NOT EXISTS(SELECT 1 FROM public.horse_watchlist WHERE user_id=uid AND horse_id=swap_id AND NOT paused) THEN RAISE EXCEPTION 'WATCH_LIMIT'; END IF;
UPDATE public.horse_watchlist SET paused=true WHERE user_id=uid AND horse_id=swap_id;
END IF;
IF action='add' THEN INSERT INTO public.horse_watchlist(user_id,horse_id,horse_name) VALUES(uid,hid,left(hname,120)); ELSE UPDATE public.horse_watchlist SET paused=false,activated_at=now() WHERE user_id=uid AND horse_id=hid; END IF;
END $$;
REVOKE ALL ON FUNCTION public.mutate_horse_watch(uuid,integer,text,text,text,boolean,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mutate_horse_watch(uuid,integer,text,text,text,boolean,text) TO service_role;
CREATE OR REPLACE FUNCTION public.apply_watch_limits_all() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rec record; lim integer; BEGIN
FOR rec IN SELECT DISTINCT w.user_id, ranks.r FROM public.horse_watchlist w LEFT JOIN (SELECT u.id,row_number() OVER(ORDER BY u.created_at,u.id) AS r FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) ranks ON ranks.id=w.user_id LOOP
IF public.membership_gate_at() IS NULL THEN SELECT (value #>> '{}')::integer INTO lim FROM public.app_settings WHERE key='watch_limit_free_stage'; ELSE SELECT (value #>> '{}')::integer INTO lim FROM public.app_settings WHERE key=CASE WHEN rec.r<=public.founding_cap() AND public.membership_gate_at()+interval '364 days'>now() THEN 'watch_limit_pro' ELSE 'watch_limit_registered' END; END IF;
PERFORM public.apply_watch_limits(rec.user_id,least(90,coalesce(lim,3)));
END LOOP;
END $$;
COMMENT ON FUNCTION public.apply_watch_limits_all() IS 'Gate-opening founding allocation only; signed-in reads/mutations reapply the server resolveEntitlement limit including verified payments and expiry. No alternate payment entitlement source.';
CREATE FUNCTION public.select_active_watches(uid uuid,lim integer,horse_ids text[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF lim<1 OR lim>90 OR cardinality(horse_ids)>lim OR cardinality(horse_ids)<>(SELECT count(DISTINCT h) FROM unnest(horse_ids) h) THEN RAISE EXCEPTION 'WATCH_LIMIT'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,3323));
IF (SELECT count(*) FROM public.horse_watchlist WHERE user_id=uid AND horse_id=ANY(horse_ids))<>cardinality(horse_ids) THEN RAISE EXCEPTION 'Watch not found'; END IF;
UPDATE public.horse_watchlist SET paused=NOT(horse_id=ANY(horse_ids)),activated_at=CASE WHEN horse_id=ANY(horse_ids) THEN now() ELSE activated_at END WHERE user_id=uid;
END $$;
REVOKE ALL ON FUNCTION public.select_active_watches(uuid,integer,text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.select_active_watches(uuid,integer,text[]) TO service_role;