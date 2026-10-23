REVOKE DELETE ON public.telegram_links FROM authenticated;
CREATE TABLE public.push_delivery_receipts(user_id uuid NOT NULL, event_key text NOT NULL, subscription_id uuid NOT NULL, delivered_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,event_key,subscription_id));
GRANT ALL ON public.push_delivery_receipts TO service_role;
ALTER TABLE public.push_delivery_receipts ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION public.renew_notification_job(k text,oid uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE n integer; BEGIN UPDATE public.notification_job_leases SET expires_at=now()+interval '5 minutes' WHERE key=k AND owner=oid AND expires_at>now(); GET DIAGNOSTICS n=ROW_COUNT; RETURN n=1; END $$;
REVOKE ALL ON FUNCTION public.renew_notification_job(text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.renew_notification_job(text,uuid) TO service_role;