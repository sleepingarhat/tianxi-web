-- DRAFT ONLY — 唔自動 apply 生產。P1 通知新事件類型（lock_complete / top4_lock / daily_pnl）。
-- 跟現有 free_stage／tier：開閘後屬 Pro（註冊會員 UI disabled＋說明）；job 用 membership_entitlement。

ALTER TABLE public.notification_prefs
  ADD COLUMN IF NOT EXISTS lock_complete_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS top4_lock_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS daily_pnl_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.notification_prefs.lock_complete_enabled IS '賽前鎖定完成（最終版）通知；開閘後建議 Pro。';
COMMENT ON COLUMN public.notification_prefs.top4_lock_enabled IS '愛駒入四揀（只限鎖定後 final；draft 永遠唔通知）。';
COMMENT ON COLUMN public.notification_prefs.daily_pnl_enabled IS '官方策略每日盈虧（正式戰績起 2026-10-04）。';

-- 擴展 watch_notifications.event_type CHECK
ALTER TABLE public.watch_notifications DROP CONSTRAINT IF EXISTS watch_notifications_event_type_check;
ALTER TABLE public.watch_notifications
  ADD CONSTRAINT watch_notifications_event_type_check
  CHECK (event_type IN (
    'entry','trackwork','trial','injury','raceday',
    'lock_complete','top4_lock','daily_pnl'
  ));
