CREATE TABLE public.app_settings (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(), updated_by uuid);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY settings_public_read ON public.app_settings FOR SELECT TO anon, authenticated USING (key IN ('paywall_threshold','watch_limit_free_stage','watch_limit_registered','watch_limit_pro','gate_open_at','founding_slots_locked','crypto_pass_enabled','crypto_pass_price_usd'));
CREATE POLICY settings_admin_write ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.paywall_threshold() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT coalesce((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'paywall_threshold'), 200) $$;
CREATE FUNCTION public.founding_cap() RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT coalesce((SELECT (value #>> '{}')::int FROM public.app_settings WHERE key = 'founding_slots_locked'), public.paywall_threshold()) $$;
CREATE FUNCTION public.membership_gate_at() RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT (value #>> '{}')::timestamptz FROM public.app_settings WHERE key = 'gate_open_at' $$;
CREATE FUNCTION public.apply_watch_limits_all() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN RETURN; END $$;
REVOKE ALL ON FUNCTION public.apply_watch_limits_all() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.apply_watch_limits_all() TO service_role;
CREATE FUNCTION public.guard_membership_settings() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN
IF TG_OP IN ('UPDATE','DELETE') AND OLD.key IN ('gate_open_at','founding_slots_locked') THEN RAISE EXCEPTION 'Membership gate and founding cap are immutable'; END IF;
IF TG_OP IN ('INSERT','UPDATE') THEN
IF NEW.key IN ('paywall_threshold','watch_limit_free_stage','watch_limit_registered','watch_limit_pro') AND (jsonb_typeof(NEW.value) <> 'number' OR (NEW.value #>> '{}') !~ '^[1-9][0-9]*$' OR (NEW.value #>> '{}')::numeric > 100000) THEN RAISE EXCEPTION 'Invalid membership setting'; END IF;
NEW.updated_at := now(); RETURN NEW;
END IF;
RETURN OLD; END $$;
CREATE TRIGGER guard_membership_settings BEFORE INSERT OR UPDATE OR DELETE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.guard_membership_settings();
CREATE FUNCTION public.open_membership_gate_if_ready() RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE threshold integer; BEGIN
PERFORM pg_advisory_xact_lock(8231023);
IF public.membership_gate_at() IS NOT NULL THEN RETURN false; END IF;
threshold := public.paywall_threshold();
IF public.public_member_count() < threshold THEN RETURN false; END IF;
INSERT INTO public.app_settings(key,value) VALUES ('gate_open_at',to_jsonb(now())), ('founding_slots_locked',to_jsonb(threshold));
PERFORM public.apply_watch_limits_all(); RETURN true; END $$;
REVOKE ALL ON FUNCTION public.open_membership_gate_if_ready() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.open_membership_gate_if_ready() TO service_role;
CREATE FUNCTION public.membership_signup_gate() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN PERFORM public.open_membership_gate_if_ready(); RETURN NEW; END $$;
CREATE TRIGGER membership_signup_gate AFTER INSERT ON auth.users FOR EACH STATEMENT EXECUTE FUNCTION public.membership_signup_gate();
CREATE FUNCTION public.admin_open_gate_now() RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ DECLARE threshold integer; BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
PERFORM pg_advisory_xact_lock(8231023);
IF public.membership_gate_at() IS NULL THEN
threshold := public.paywall_threshold(); INSERT INTO public.app_settings(key,value,updated_by) VALUES ('gate_open_at',to_jsonb(now()),auth.uid()), ('founding_slots_locked',to_jsonb(threshold),auth.uid()); PERFORM public.apply_watch_limits_all();
END IF;
RETURN jsonb_build_object('gate_open_at',public.membership_gate_at(),'founding_slots',public.founding_cap()); END $$;
REVOKE ALL ON FUNCTION public.admin_open_gate_now() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.admin_open_gate_now() TO authenticated;
CREATE OR REPLACE FUNCTION public.my_membership() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$ DECLARE me uuid := auth.uid(); my_rank integer; total integer; gate_at timestamptz; BEGIN
IF me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
SELECT r INTO my_rank FROM (SELECT u.id, ROW_NUMBER() OVER (ORDER BY u.created_at,u.id)::int AS r FROM auth.users u WHERE NOT EXISTS (SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) q WHERE q.id=me;
total := public.public_member_count(); gate_at := public.membership_gate_at();
RETURN jsonb_build_object('rank',my_rank,'total',total,'gate_open_at',gate_at,'threshold',public.paywall_threshold(),'founding_slots',public.founding_cap(),'gate_open',gate_at IS NOT NULL); END $$;
REVOKE ALL ON FUNCTION public.my_membership() FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.my_membership() TO authenticated;
CREATE FUNCTION public.public_founding_info() RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT jsonb_build_object('total',public.public_member_count(),'threshold',public.paywall_threshold(),'founding_slots',public.founding_cap(),'remaining',greatest(0,public.founding_cap()-public.public_member_count()),'gate_open',public.membership_gate_at() IS NOT NULL) $$;
REVOKE ALL ON FUNCTION public.paywall_threshold(), public.founding_cap(), public.membership_gate_at(), public.public_founding_info() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.paywall_threshold(), public.founding_cap(), public.membership_gate_at(), public.public_founding_info() TO anon, authenticated, service_role;