CREATE TABLE public.crypto_passes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waiting','confirming','confirmed','sending','partially_paid','finished','failed','refunded','expired','manual_granted','revoked')), price_usd numeric(10,2) NOT NULL CHECK(price_usd>0), weeks integer NOT NULL DEFAULT 52 CHECK(weeks BETWEEN 1 AND 520), environment text NOT NULL DEFAULT 'sandbox' CHECK(environment IN ('sandbox','live')), invoice_id text UNIQUE, payment_id text UNIQUE, pay_currency text, actually_paid numeric, paid_at timestamptz, valid_from timestamptz, valid_until timestamptz, last_ipn jsonb, admin_note text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.crypto_passes TO authenticated; GRANT ALL ON public.crypto_passes TO service_role;
ALTER TABLE public.crypto_passes ENABLE ROW LEVEL SECURITY;
CREATE POLICY crypto_owner_read ON public.crypto_passes FOR SELECT TO authenticated USING(user_id=auth.uid());
CREATE POLICY crypto_admin_read ON public.crypto_passes FOR SELECT TO authenticated USING(public.has_role(auth.uid(),'admin'));
CREATE INDEX crypto_user_expiry ON public.crypto_passes(user_id,valid_until DESC);
CREATE POLICY crypto_weeks_public_read ON public.app_settings FOR SELECT TO anon,authenticated USING(key='crypto_pass_weeks');
CREATE FUNCTION public.reserve_crypto_checkout(uid uuid, env text, amount numeric, duration integer) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE pid uuid; BEGIN
PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,714));
IF env NOT IN ('sandbox','live') OR amount<=0 OR duration NOT BETWEEN 1 AND 520 THEN RAISE EXCEPTION 'Invalid order'; END IF;
IF public.membership_gate_at() IS NULL OR NOT coalesce((SELECT (value#>>'{}')::boolean FROM public.app_settings WHERE key='crypto_pass_enabled'),false) THEN RAISE EXCEPTION 'Checkout disabled'; END IF;
IF (SELECT count(*) FROM public.crypto_passes WHERE user_id=uid AND created_at>=date_trunc('day',now() AT TIME ZONE 'Asia/Hong_Kong') AT TIME ZONE 'Asia/Hong_Kong')>=3 THEN RAISE EXCEPTION 'Daily checkout limit'; END IF;
INSERT INTO public.crypto_passes(user_id,environment,price_usd,weeks) VALUES(uid,env,amount,duration) RETURNING id INTO pid; RETURN pid; END $$;
REVOKE ALL ON FUNCTION public.reserve_crypto_checkout(uuid,text,numeric,integer) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.reserve_crypto_checkout(uuid,text,numeric,integer) TO service_role;
CREATE FUNCTION public.apply_crypto_ipn(payload jsonb,env text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.crypto_passes; s text:=payload->>'payment_status'; rank integer; gate_at timestamptz; starts timestamptz; other_end timestamptz; granted boolean:=false; BEGIN
SELECT * INTO p FROM public.crypto_passes WHERE id=(payload->>'order_id')::uuid; IF NOT FOUND THEN RAISE EXCEPTION 'Unknown order'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p.user_id::text,714)); SELECT * INTO p FROM public.crypto_passes WHERE id=p.id FOR UPDATE;
IF p.environment<>env OR p.invoice_id IS NULL OR p.invoice_id IS DISTINCT FROM payload->>'invoice_id' OR (payload->>'price_amount')::numeric<>p.price_usd OR lower(payload->>'price_currency') IS DISTINCT FROM 'usd' OR (p.payment_id IS NOT NULL AND p.payment_id IS DISTINCT FROM payload->>'payment_id') THEN RAISE EXCEPTION 'Payment identity mismatch'; END IF;
IF s NOT IN ('waiting','confirming','confirmed','sending','partially_paid','finished','failed','refunded','expired') THEN RAISE EXCEPTION 'Invalid status'; END IF;
IF p.status IN ('refunded','revoked','manual_granted') OR (p.status='finished' AND s<>'refunded') THEN RETURN jsonb_build_object('granted',false,'ignored',true,'user_id',p.user_id); END IF;
IF array_position(ARRAY['pending','waiting','confirming','confirmed','sending','partially_paid'],s)<array_position(ARRAY['pending','waiting','confirming','confirmed','sending','partially_paid'],p.status) THEN RETURN jsonb_build_object('granted',false,'ignored',true,'user_id',p.user_id); END IF;
IF s='finished' AND p.valid_until IS NULL THEN
SELECT r INTO rank FROM (SELECT u.id,row_number() OVER(ORDER BY u.created_at,u.id)::integer r FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) ranks WHERE id=p.user_id;
gate_at:=public.membership_gate_at(); SELECT max(valid_until) INTO other_end FROM public.crypto_passes WHERE user_id=p.user_id AND environment=env AND status IN ('finished','manual_granted') AND id<>p.id;
starts:=greatest(now(), CASE WHEN rank<=public.founding_cap() THEN gate_at+interval '364 days' END, other_end); p.valid_from:=starts; p.valid_until:=starts+make_interval(days=>p.weeks*7); p.paid_at:=now(); granted:=true;
ELSIF s='refunded' THEN p.valid_until:=now(); END IF;
UPDATE public.crypto_passes SET status=s,payment_id=payload->>'payment_id',pay_currency=payload->>'pay_currency',actually_paid=(payload->>'actually_paid')::numeric,last_ipn=payload,valid_from=p.valid_from,valid_until=p.valid_until,paid_at=p.paid_at,updated_at=now() WHERE id=p.id;
RETURN jsonb_build_object('granted',granted,'user_id',p.user_id,'valid_until',p.valid_until); END $$;
REVOKE ALL ON FUNCTION public.apply_crypto_ipn(jsonb,text) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_crypto_ipn(jsonb,text) TO service_role;
CREATE FUNCTION public.admin_crypto_action(pid uuid,action text,note text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE p public.crypto_passes; starts timestamptz; r integer; BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
IF action NOT IN ('grant','revoke') OR length(trim(note))<3 OR length(note)>500 THEN RAISE EXCEPTION 'Reason required'; END IF;
SELECT * INTO p FROM public.crypto_passes WHERE id=pid; IF NOT FOUND THEN RAISE EXCEPTION 'Unknown pass'; END IF; PERFORM pg_advisory_xact_lock(hashtextextended(p.user_id::text,714)); SELECT * INTO p FROM public.crypto_passes WHERE id=pid FOR UPDATE;
IF action='grant' THEN IF p.status IN ('finished','manual_granted') THEN RAISE EXCEPTION 'Already granted'; END IF;
SELECT rank INTO r FROM (SELECT u.id,row_number() OVER(ORDER BY u.created_at,u.id)::integer rank FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) q WHERE id=p.user_id;
SELECT greatest(now(),CASE WHEN r<=public.founding_cap() THEN public.membership_gate_at()+interval '364 days' END,max(valid_until)) INTO starts FROM public.crypto_passes WHERE user_id=p.user_id AND environment=p.environment AND status IN ('finished','manual_granted') AND id<>pid;
UPDATE public.crypto_passes SET status='manual_granted',valid_from=starts,valid_until=starts+make_interval(days=>weeks*7),admin_note=concat_ws(E'\n',admin_note,now()::text||' admin='||auth.uid()::text||' grant: '||note),updated_at=now() WHERE id=pid;
ELSE UPDATE public.crypto_passes SET status='revoked',valid_until=now(),admin_note=concat_ws(E'\n',admin_note,now()::text||' admin='||auth.uid()::text||' revoke: '||note),updated_at=now() WHERE id=pid; END IF; END $$;
REVOKE ALL ON FUNCTION public.admin_crypto_action(uuid,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.admin_crypto_action(uuid,text,text) TO authenticated;
CREATE FUNCTION public.crypto_pass_until(uid uuid,env text) RETURNS timestamptz LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT max(valid_until) FROM public.crypto_passes WHERE user_id=uid AND environment=env AND status IN ('finished','manual_granted') AND valid_from<=now() AND valid_until>now() AND (auth.uid()=uid OR auth.role()='service_role') $$;
REVOKE ALL ON FUNCTION public.crypto_pass_until(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.crypto_pass_until(uuid,text) TO authenticated,service_role;