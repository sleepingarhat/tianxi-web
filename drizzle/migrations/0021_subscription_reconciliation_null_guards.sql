CREATE OR REPLACE FUNCTION public.reconcile_subscription_event(_environment text, _event_id text, _subscription_id text, _expected_revision bigint, _snapshot jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE state_revision bigint; existing_user uuid; existing_env text; new_user uuid;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
 IF _environment IS NULL OR _environment NOT IN ('sandbox','live') OR coalesce(_event_id,'')='' OR coalesce(_subscription_id,'')='' OR _expected_revision IS NULL OR _expected_revision < 0 THEN RAISE EXCEPTION 'Invalid event identity or revision'; END IF;
 IF _snapshot IS NULL OR jsonb_typeof(_snapshot) IS DISTINCT FROM 'object' OR coalesce(_snapshot->>'user_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' OR coalesce(_snapshot->>'stripe_customer_id','')='' OR coalesce(_snapshot->>'product_id','')='' OR coalesce(_snapshot->>'price_id','')='' OR coalesce(_snapshot->>'status','') NOT IN ('active','trialing','past_due','unpaid','incomplete','incomplete_expired','paused','canceled') THEN RAISE EXCEPTION 'Incomplete subscription snapshot'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(_environment || ':' || _subscription_id, 0));
 IF EXISTS(SELECT 1 FROM public.subscription_event_receipts WHERE environment=_environment AND event_id=_event_id) THEN RETURN jsonb_build_object('applied',false,'duplicate',true); END IF;
 SELECT revision INTO state_revision FROM public.subscription_event_state WHERE environment=_environment AND subscription_id=_subscription_id;
 state_revision := coalesce(state_revision,0);
 IF state_revision <> _expected_revision THEN RAISE EXCEPTION 'Concurrent reconciliation; retry provider read'; END IF;
 new_user := (_snapshot->>'user_id')::uuid;
 SELECT user_id, environment INTO existing_user, existing_env FROM public.subscriptions WHERE stripe_subscription_id=_subscription_id;
 IF existing_user IS NOT NULL AND (existing_user <> new_user OR existing_env <> _environment) THEN RAISE EXCEPTION 'Subscription ownership mismatch'; END IF;
 INSERT INTO public.subscriptions(user_id,stripe_subscription_id,stripe_customer_id,product_id,price_id,status,current_period_start,current_period_end,cancel_at_period_end,environment,updated_at)
 VALUES(new_user,_subscription_id,_snapshot->>'stripe_customer_id',_snapshot->>'product_id',_snapshot->>'price_id',_snapshot->>'status',(_snapshot->>'current_period_start')::timestamptz,(_snapshot->>'current_period_end')::timestamptz,coalesce((_snapshot->>'cancel_at_period_end')::boolean,false),_environment,now())
 ON CONFLICT(stripe_subscription_id) DO UPDATE SET stripe_customer_id=EXCLUDED.stripe_customer_id,product_id=EXCLUDED.product_id,price_id=EXCLUDED.price_id,status=EXCLUDED.status,current_period_start=EXCLUDED.current_period_start,current_period_end=EXCLUDED.current_period_end,cancel_at_period_end=EXCLUDED.cancel_at_period_end,updated_at=EXCLUDED.updated_at;
 INSERT INTO public.subscription_event_state(environment,subscription_id,revision,last_event_id) VALUES(_environment,_subscription_id,state_revision+1,_event_id)
 ON CONFLICT(environment,subscription_id) DO UPDATE SET revision=EXCLUDED.revision,last_event_id=EXCLUDED.last_event_id,reconciled_at=now();
 INSERT INTO public.subscription_event_receipts(environment,event_id,subscription_id) VALUES(_environment,_event_id,_subscription_id);
 RETURN jsonb_build_object('applied',true,'revision',state_revision+1);
END; $$;
REVOKE ALL ON FUNCTION public.reconcile_subscription_event(text,text,text,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_subscription_event(text,text,text,bigint,jsonb) TO service_role;