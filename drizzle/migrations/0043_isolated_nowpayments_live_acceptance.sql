CREATE TABLE public.payment_acceptance_invoices (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 invoice_id text UNIQUE,
 invoice_url text,
 payment_id text UNIQUE,
 price_usd numeric NOT NULL DEFAULT 10 CHECK (price_usd = 10),
 pay_currency text NOT NULL DEFAULT 'usdtbsc' CHECK (pay_currency = 'usdtbsc'),
 environment text NOT NULL DEFAULT 'live' CHECK (environment = 'live'),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','waiting','confirming','confirmed','sending','partially_paid','finished','failed','refunded','expired')),
 actually_paid numeric NOT NULL DEFAULT 0 CHECK (actually_paid >= 0),
 verified_receipt jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.payment_acceptance_invoices TO authenticated;
GRANT ALL ON public.payment_acceptance_invoices TO service_role;
ALTER TABLE public.payment_acceptance_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY acceptance_admin_read ON public.payment_acceptance_invoices FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE FUNCTION public.reserve_payment_acceptance(uid uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE found_id uuid;
BEGIN
 IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 107));
 SELECT id INTO found_id FROM public.payment_acceptance_invoices WHERE owner_id = uid AND status IN ('pending','waiting','confirming','confirmed','sending','partially_paid') ORDER BY created_at DESC LIMIT 1;
 IF found_id IS NOT NULL THEN RETURN found_id; END IF;
 IF (SELECT count(*) FROM public.payment_acceptance_invoices WHERE owner_id = uid AND created_at > now() - interval '24 hours') >= 3 THEN RAISE EXCEPTION 'daily_limit'; END IF;
 INSERT INTO public.payment_acceptance_invoices(owner_id) VALUES (uid) RETURNING id INTO found_id;
 RETURN found_id;
END;
$$;
REVOKE ALL ON FUNCTION public.reserve_payment_acceptance(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_payment_acceptance(uuid) TO service_role;

CREATE FUNCTION public.apply_payment_acceptance_receipt(payload jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.payment_acceptance_invoices%ROWTYPE; incoming text := payload->>'payment_status';
BEGIN
 SELECT * INTO r FROM public.payment_acceptance_invoices WHERE id = (payload->>'order_id')::uuid FOR UPDATE;
 IF NOT FOUND OR r.invoice_id IS NULL OR r.invoice_id <> payload->>'invoice_id' OR r.price_usd <> (payload->>'price_amount')::numeric OR lower(payload->>'price_currency') <> 'usd' OR lower(payload->>'pay_currency') <> 'usdtbsc' THEN RAISE EXCEPTION 'identity_mismatch'; END IF;
 IF r.payment_id IS NOT NULL AND r.payment_id <> payload->>'payment_id' THEN RAISE EXCEPTION 'payment_identity_mismatch'; END IF;
 IF (payload->>'actually_paid')::numeric < 0 OR incoming NOT IN ('waiting','confirming','confirmed','sending','partially_paid','finished','failed','refunded','expired') THEN RAISE EXCEPTION 'invalid_receipt'; END IF;
 IF r.status = 'refunded' OR (r.status = 'finished' AND incoming <> 'refunded') THEN RETURN true; END IF;
 IF array_position(ARRAY['pending','waiting','confirming','confirmed','sending','partially_paid'], incoming) < array_position(ARRAY['pending','waiting','confirming','confirmed','sending','partially_paid'], r.status) THEN RETURN true; END IF;
 UPDATE public.payment_acceptance_invoices SET payment_id = payload->>'payment_id', status = incoming, actually_paid = (payload->>'actually_paid')::numeric, verified_receipt = payload, updated_at = now() WHERE id = r.id;
 RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_payment_acceptance_receipt(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_payment_acceptance_receipt(jsonb) TO service_role;
COMMENT ON TABLE public.payment_acceptance_invoices IS 'Isolated USD10 live BSC acceptance receipts only; never grants membership or writes crypto_passes/subscriptions.';