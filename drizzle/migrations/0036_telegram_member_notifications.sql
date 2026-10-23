CREATE TABLE public.telegram_links (user_id uuid PRIMARY KEY, telegram_user_id bigint NOT NULL UNIQUE, telegram_username text, chat_id bigint NOT NULL, linked_at timestamptz NOT NULL DEFAULT now(), dm_blocked boolean NOT NULL DEFAULT false, pro_joined_at timestamptz, pro_removed_at timestamptz, last_checked_at timestamptz);
GRANT SELECT, DELETE ON public.telegram_links TO authenticated; GRANT ALL ON public.telegram_links TO service_role;
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_links_owner_select ON public.telegram_links FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY telegram_links_owner_delete ON public.telegram_links FOR DELETE TO authenticated USING(user_id=auth.uid());
CREATE TABLE public.telegram_link_tokens(token_hash text PRIMARY KEY,user_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL,used_at timestamptz);
GRANT ALL ON public.telegram_link_tokens TO service_role; ALTER TABLE public.telegram_link_tokens ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.telegram_pro_invites(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,user_id uuid NOT NULL,invite_link text NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL);
GRANT ALL ON public.telegram_pro_invites TO service_role; GRANT USAGE,SELECT ON SEQUENCE public.telegram_pro_invites_id_seq TO service_role; ALTER TABLE public.telegram_pro_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_prefs ADD COLUMN last_limit_notice_at timestamptz;
CREATE TABLE public.watch_job_runs(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,kind text NOT NULL DEFAULT 'watch',started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz,horses integer NOT NULL DEFAULT 0,events integer NOT NULL DEFAULT 0,new_rows integer NOT NULL DEFAULT 0,tg_sent integer NOT NULL DEFAULT 0,tg_failed integer NOT NULL DEFAULT 0,push_sent integer NOT NULL DEFAULT 0,push_failed integer NOT NULL DEFAULT 0,feed_freshness jsonb,error text);
GRANT SELECT ON public.watch_job_runs TO authenticated; GRANT ALL ON public.watch_job_runs TO service_role; GRANT USAGE,SELECT ON SEQUENCE public.watch_job_runs_id_seq TO service_role; ALTER TABLE public.watch_job_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY watch_job_runs_admin ON public.watch_job_runs FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.membership_for_notification_job(uid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE r integer; BEGIN
IF NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Missing account'; END IF;
SELECT rank INTO r FROM (SELECT id,row_number() OVER(ORDER BY created_at,id)::int rank FROM auth.users WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=auth.users.id)) u WHERE id=uid;
RETURN jsonb_build_object('rank',r,'total',public.public_member_count(),'gate_open_at',public.membership_gate_at(),'threshold',public.paywall_threshold(),'founding_slots',public.founding_cap()); END $$;
REVOKE ALL ON FUNCTION public.membership_for_notification_job(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.membership_for_notification_job(uuid) TO service_role;
CREATE FUNCTION public.create_telegram_link_token(uid uuid,hash text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,441));
IF (SELECT count(*) FROM public.telegram_link_tokens WHERE user_id=uid AND created_at>now()-interval '1 hour')>=5 THEN RAISE EXCEPTION 'TOKEN_LIMIT'; END IF;
INSERT INTO public.telegram_link_tokens(token_hash,user_id,expires_at) VALUES(hash,uid,now()+interval '15 minutes'); END $$;
REVOKE ALL ON FUNCTION public.create_telegram_link_token(uuid,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.create_telegram_link_token(uuid,text) TO service_role;
CREATE FUNCTION public.consume_telegram_link_token(hash text,tid bigint,tname text,cid bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE uid uuid; olduid uuid; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(tid::text,442));
UPDATE public.telegram_link_tokens SET used_at=now() WHERE token_hash=hash AND used_at IS NULL AND expires_at>now() RETURNING user_id INTO uid;
IF uid IS NULL OR tid<>cid THEN RETURN false; END IF;
SELECT user_id INTO olduid FROM public.telegram_links WHERE telegram_user_id=tid;
-- Do not silently move an account that still has channel access; removal must succeed first.
IF olduid IS NOT NULL AND olduid<>uid AND EXISTS(SELECT 1 FROM public.telegram_links WHERE user_id=olduid AND pro_joined_at IS NOT NULL AND pro_removed_at IS NULL) THEN RAISE EXCEPTION 'REMOVE_PRO_BEFORE_TRANSFER'; END IF;
DELETE FROM public.telegram_links WHERE telegram_user_id=tid AND user_id<>uid;
INSERT INTO public.telegram_links(user_id,telegram_user_id,telegram_username,chat_id) VALUES(uid,tid,tname,cid) ON CONFLICT(user_id) DO UPDATE SET telegram_user_id=excluded.telegram_user_id,telegram_username=excluded.telegram_username,chat_id=excluded.chat_id,linked_at=now(),dm_blocked=false,pro_joined_at=NULL,pro_removed_at=NULL;
INSERT INTO public.notification_prefs(user_id,telegram_enabled) VALUES(uid,true) ON CONFLICT(user_id) DO UPDATE SET telegram_enabled=true;
RETURN true; END $$;
REVOKE ALL ON FUNCTION public.consume_telegram_link_token(text,bigint,text,bigint) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.consume_telegram_link_token(text,bigint,text,bigint) TO service_role;
CREATE FUNCTION public.reserve_telegram_invite(uid uuid) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE ident bigint; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,443));
IF (SELECT count(*) FROM public.telegram_pro_invites WHERE user_id=uid AND created_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Hong_Kong') AT TIME ZONE 'Asia/Hong_Kong')>=3 THEN RAISE EXCEPTION 'INVITE_LIMIT'; END IF;
INSERT INTO public.telegram_pro_invites(user_id,expires_at) VALUES(uid,now()+interval '1 hour') RETURNING id INTO ident; RETURN ident; END $$;
REVOKE ALL ON FUNCTION public.reserve_telegram_invite(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.reserve_telegram_invite(uuid) TO service_role;
CREATE TABLE public.notification_job_leases(key text PRIMARY KEY,owner uuid NOT NULL,expires_at timestamptz NOT NULL);
GRANT ALL ON public.notification_job_leases TO service_role; ALTER TABLE public.notification_job_leases ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.acquire_notification_job(k text,oid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN
INSERT INTO public.notification_job_leases(key,owner,expires_at) VALUES(k,oid,now()+interval '5 minutes') ON CONFLICT(key) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE notification_job_leases.expires_at<now(); GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;END $$;
REVOKE ALL ON FUNCTION public.acquire_notification_job(text,uuid) FROM PUBLIC,anon,authenticated;GRANT EXECUTE ON FUNCTION public.acquire_notification_job(text,uuid) TO service_role;