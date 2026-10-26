/**
 * Pro P1：拉 Worker /api/notify/events → join prefs／愛駒 → event_key 去重 → Telegram／Web Push。
 * 跟 horse-watch／raceday 同一套 lease＋watch_notifications／deliverEventPush。
 */
import { jobMembership } from './job-membership.server';
import { tgRetry } from './telegram.server';
import { vapidConfig } from './webpush.server';
import { deliverEventPush, renewNotificationLease } from './notification-delivery.server';
import { watchFeedSenderSecret } from './shared-secret.server';
import {
  NOTIFY_EVENT_TYPES,
  acceptsNotifyEvent,
  isDeliverableTop4,
  notifyEventMessage,
  type NotifyFeedEvent,
} from './notify-events';
import type { Json } from '@/integrations/supabase/types';

const FEED_URL = 'https://tianxi-backend.tianxi-entertainment.workers.dev/api/notify/events';

function sinceIso(daysBack = 3): string {
  return new Date(Date.now() - daysBack * 86400_000).toISOString();
}

export async function runNotifyEventsJob() {
  if (!process.env['TIANXI_RACING_BOT_TOKEN'] && !vapidConfig()) return { skipped: 'notifications_not_configured' };
  if (!watchFeedSenderSecret()) return { skipped: 'feed_not_configured' };

  const { supabaseAdmin: db } = await import('@/integrations/supabase/client.server');
  const owner = crypto.randomUUID();
  const lease = await db.rpc('acquire_notification_job', { k: 'notify-events', oid: owner });
  if (lease.error) throw new Error('通知工作鎖未能建立');
  if (!lease.data) return { skipped: 'running' };

  const renew = () => renewNotificationLease('notify-events', owner);
  const started = await db.from('watch_job_runs').insert({ kind: 'notify-events' }).select('id').single();
  if (started.error) {
    await db.from('notification_job_leases').delete().eq('key', 'notify-events').eq('owner', owner);
    throw new Error('通知紀錄未能建立');
  }

  const counts = { events: 0, new_rows: 0, tg_sent: 0, tg_failed: 0, push_sent: 0, push_failed: 0, horses: 0 };
  let freshness: Json | null = null;
  let error: string | null = null;

  try {
    const secret = watchFeedSenderSecret();
    if (!secret) throw new Error('feed_not_configured');
    const url = `${FEED_URL}?since=${encodeURIComponent(sinceIso(3))}&types=${NOTIFY_EVENT_TYPES.join(',')}`;
    const res = await fetch(url, {
      headers: { 'x-cron-secret': secret },
      signal: AbortSignal.timeout(15000),
    });
    if ([404, 503].includes(res.status)) return { ...counts, skipped: 'feed_unavailable' };
    if (!res.ok) throw new Error(`feed_${res.status}`);
    const feed = (await res.json()) as { events?: NotifyFeedEvent[]; generatedAt?: string };
    freshness = { generatedAt: feed.generatedAt ?? null } as Json;
    const events = (feed.events ?? []).filter(
      (e) =>
        e.event_key &&
        NOTIFY_EVENT_TYPES.includes(e.type as (typeof NOTIFY_EVENT_TYPES)[number]) &&
        isDeliverableTop4(e),
    );
    counts.events = events.length;
    if (!events.length) return { ...counts, ok: true };

    const prefs = await db.from('notification_prefs').select('*');
    if (prefs.error) throw new Error('prefs_unavailable');
    const links = await db.from('telegram_links').select('*');
    if (links.error) throw new Error('links_unavailable');
    const watch = await db.from('horse_watchlist').select('user_id,horse_id,horse_name,paused').eq('paused', false);
    if (watch.error) throw new Error('watch_unavailable');
    counts.horses = new Set(watch.data.map((w) => w.horse_id)).size;

    const users = [...new Set(prefs.data.map((p) => p.user_id))];
    const membership = new Map<string, { hasPro: boolean }>();
    for (const uid of users) {
      await renew();
      membership.set(uid, await jobMembership(uid));
    }

    // 寫入去重帳本
    for (const event of events) {
      await renew();
      const recipients = new Set<string>();
      if (event.type === 'top4_lock') {
        if (!event.horse_id) continue;
        for (const w of watch.data.filter((w) => w.horse_id === event.horse_id)) recipients.add(w.user_id);
      } else {
        for (const p of prefs.data) recipients.add(p.user_id);
      }
      for (const uid of recipients) {
        const p = prefs.data.find((r) => r.user_id === uid);
        const mem = membership.get(uid);
        if (!p || !mem || !acceptsNotifyEvent(event.type, p, mem.hasPro)) continue;
        const horseName =
          event.type === 'top4_lock'
            ? watch.data.find((w) => w.user_id === uid && w.horse_id === event.horse_id)?.horse_name
            : null;
        const msg = notifyEventMessage(event, horseName);
        const insert = await db
          .from('watch_notifications')
          .upsert(
            {
              user_id: uid,
              horse_id: event.horse_id ?? null,
              event_key: event.event_key,
              event_type: event.type,
              event_date: (event.meeting_date as string) || null,
              title: msg.title,
              payload: { ...event, _message: msg } as unknown as Json,
            },
            { onConflict: 'user_id,event_key', ignoreDuplicates: true },
          )
          .select('id');
        if (insert.error) throw new Error('event_write_failed');
        counts.new_rows += insert.data.length;
      }
    }

    // 派送未送出嘅列（只限今次三種 type）
    for (const uid of users) {
      await renew();
      const p = prefs.data.find((r) => r.user_id === uid);
      const mem = membership.get(uid);
      if (!p || !mem?.hasPro) continue;
      const pending = await db
        .from('watch_notifications')
        .select('*')
        .eq('user_id', uid)
        .in('event_type', [...NOTIFY_EVENT_TYPES])
        .or('telegram_sent_at.is.null,push_sent_at.is.null')
        .gte('created_at', new Date(Date.now() - 14 * 86400_000).toISOString())
        .order('id')
        .limit(100);
      if (pending.error) throw new Error('pending_failed');

      const link = links.data.find((r) => r.user_id === uid);
      for (const row of pending.data) {
        if (!acceptsNotifyEvent(row.event_type, p, true)) continue;
        const payload = row.payload as unknown as NotifyFeedEvent & { _message?: ReturnType<typeof notifyEventMessage> };
        const msg =
          payload._message ??
          notifyEventMessage(payload, watch.data.find((w) => w.user_id === uid && w.horse_id === row.horse_id)?.horse_name);

        if (!row.telegram_sent_at && p.telegram_enabled && link && !link.dm_blocked && process.env['TIANXI_RACING_BOT_TOKEN']) {
          await renew();
          const sent = await tgRetry('sendMessage', {
            chat_id: link.chat_id,
            text: msg.text,
            disable_web_page_preview: true,
          });
          if (sent.ok) {
            const saved = await db
              .from('watch_notifications')
              .update({ telegram_sent_at: new Date().toISOString() })
              .eq('id', row.id);
            if (saved.error) throw new Error('delivery_record_failed');
            counts.tg_sent++;
          } else {
            counts.tg_failed++;
            if (sent.error_code === 403) await db.from('telegram_links').update({ dm_blocked: true }).eq('user_id', uid);
          }
          await new Promise((r) => setTimeout(r, 50));
        }

        if (!row.push_sent_at && p.push_enabled && vapidConfig()) {
          const subs = await db.from('push_subscriptions').select('*').eq('user_id', uid);
          if (subs.error) throw new Error('push_unavailable');
          let complete = subs.data.length > 0;
          for (const sub of subs.data) {
            if (
              await deliverEventPush(
                uid,
                row.event_key,
                sub,
                { title: msg.title, body: msg.body, url: msg.url, tag: row.event_key },
                21600,
                renew,
              )
            ) {
              counts.push_sent++;
            } else {
              counts.push_failed++;
              complete = false;
            }
          }
          if (complete) {
            const saved = await db
              .from('watch_notifications')
              .update({ push_sent_at: new Date().toISOString() })
              .eq('id', row.id);
            if (saved.error) throw new Error('push_record_failed');
          }
        }
      }
    }

    return { ok: counts.tg_failed === 0 && counts.push_failed === 0, ...counts };
  } catch (e) {
    error = e instanceof Error ? e.message : 'notify_events_failed';
    throw e;
  } finally {
    await db
      .from('watch_job_runs')
      .update({ ...counts, feed_freshness: freshness, error, finished_at: new Date().toISOString() })
      .eq('id', started.data.id);
    await db.from('notification_job_leases').delete().eq('key', 'notify-events').eq('owner', owner);
  }
}
