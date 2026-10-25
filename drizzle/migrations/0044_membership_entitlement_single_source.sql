-- 會籍權益單一真相來源（Worker 同網站共用）。只喺 PR 內，未套用。
-- 規則逐條對應 src/lib/entitlement.ts resolveEntitlement；付款環境只讀 app_settings.membership_payment_environment
-- （已驗收＝live），唔再由前端 VITE token 推斷。
CREATE OR REPLACE FUNCTION public.membership_payment_environment() RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE env text:=coalesce((SELECT value#>>'{}' FROM public.app_settings WHERE key='membership_payment_environment'),'sandbox'); BEGIN
IF env NOT IN ('live','sandbox') THEN RAISE EXCEPTION 'Invalid payment environment'; END IF;
RETURN env; END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.membership_payment_environment() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.membership_payment_environment() TO authenticated,service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public._membership_entitlement(uid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE
env text:=public.membership_payment_environment(); gate_at timestamptz:=public.membership_gate_at(); slots integer:=public.founding_cap(); thr integer:=public.paywall_threshold(); tot integer:=public.public_member_count();
my_rank integer; sub record; pass_until timestamptz; admin boolean; k text; pro boolean; until_at timestamptz; cancel_end boolean; founding_end timestamptz; BEGIN
IF uid IS NULL OR NOT EXISTS(SELECT 1 FROM auth.users WHERE id=uid) THEN RAISE EXCEPTION 'Missing account'; END IF;
SELECT q.r INTO my_rank FROM (SELECT u.id,row_number() OVER(ORDER BY u.created_at,u.id)::int AS r FROM auth.users u WHERE NOT EXISTS(SELECT 1 FROM public.member_test_accounts t WHERE t.user_id=u.id)) q WHERE q.id=uid;
SELECT s.status,s.current_period_end,s.cancel_at_period_end INTO sub FROM public.subscriptions s WHERE s.user_id=uid AND s.environment=env ORDER BY s.created_at DESC,s.id DESC LIMIT 1;
SELECT max(p.valid_until) INTO pass_until FROM public.crypto_passes p WHERE p.user_id=uid AND p.environment=env AND p.status IN ('finished','manual_granted') AND p.valid_from<=now() AND p.valid_until>now();
admin:=EXISTS(SELECT 1 FROM public.user_roles r WHERE r.user_id=uid AND r.role='admin');
IF sub.status IN ('past_due','unpaid','incomplete','incomplete_expired','paused') THEN k:='payment_failed';
ELSIF sub.status IN ('active','trialing') AND (sub.current_period_end IS NULL OR sub.current_period_end>now()) THEN k:='subscribed'; until_at:=sub.current_period_end; cancel_end:=coalesce(sub.cancel_at_period_end,false);
ELSIF sub.status='canceled' AND sub.current_period_end>now() THEN k:='subscribed'; until_at:=sub.current_period_end; cancel_end:=true;
ELSIF pass_until IS NOT NULL AND pass_until>now() THEN k:='crypto_pass'; until_at:=pass_until;
ELSIF gate_at IS NULL THEN k:='free_stage';
ELSIF my_rank IS NOT NULL AND my_rank<=slots AND gate_at+interval '364 days'>now() THEN k:='founding'; until_at:=gate_at+interval '364 days';
ELSIF my_rank IS NOT NULL AND my_rank<=slots AND sub.status IS NULL THEN k:='founding_expired'; until_at:=gate_at+interval '364 days';
ELSE k:='none'; END IF;
pro:=k IN ('subscribed','crypto_pass','free_stage','founding');
RETURN jsonb_build_object('kind',k,'has_pro',pro,'is_admin',admin,'tier',CASE WHEN admin OR pro THEN 'pro' ELSE 'registered' END,
'until',until_at,'cancel_at_period_end',cancel_end,'environment',env,'rank',my_rank,'total',tot,'gate_open_at',gate_at,'threshold',thr,'founding_slots',slots,
'remaining',greatest(0,thr-tot)); END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public._membership_entitlement(uuid) FROM PUBLIC,anon,authenticated;
--> statement-breakpoint
-- 用戶自己（網站 loadUserTier、Worker pro-entitlement.ts 用用戶 JWT 呼叫）
CREATE OR REPLACE FUNCTION public.my_entitlement() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
RETURN public._membership_entitlement(auth.uid()); END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.my_entitlement() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.my_entitlement() TO authenticated;
--> statement-breakpoint
-- 背景工作（通知 job，用 service_role）
CREATE OR REPLACE FUNCTION public.membership_entitlement(uid uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT public._membership_entitlement(uid) $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.membership_entitlement(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.membership_entitlement(uuid) TO service_role;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.is_pro(uid uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$ DECLARE e jsonb; BEGIN
IF NOT (auth.role()='service_role' OR auth.uid()=uid) THEN RAISE EXCEPTION 'Forbidden'; END IF;
e:=public._membership_entitlement(uid); RETURN (e->>'tier')='pro'; END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.is_pro(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.is_pro(uuid) TO authenticated,service_role;
--> statement-breakpoint
-- 關注上限批次都改用同一個判斷（行為同 0042 一致，另加 admin＝Pro）
CREATE OR REPLACE FUNCTION public.apply_watch_limits_all() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE rec record; gate_at timestamptz:=public.membership_gate_at(); lim integer; setting_key text; BEGIN
PERFORM public.membership_payment_environment();
FOR rec IN SELECT DISTINCT w.user_id FROM public.horse_watchlist w JOIN auth.users u ON u.id=w.user_id LOOP
IF gate_at IS NULL THEN setting_key:='watch_limit_free_stage';lim:=30;
ELSIF (public._membership_entitlement(rec.user_id)->>'tier')='pro' THEN setting_key:='watch_limit_pro';lim:=90;
ELSE setting_key:='watch_limit_registered';lim:=3; END IF;
SELECT coalesce((SELECT (value#>>'{}')::integer FROM public.app_settings WHERE key=setting_key),lim) INTO lim;
PERFORM public.apply_watch_limits(rec.user_id,least(90,lim)); END LOOP; END $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.apply_watch_limits_all() FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.apply_watch_limits_all() TO service_role;
