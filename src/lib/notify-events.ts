/** Pro P1 通知事件（網站側）：訊息格式、prefs 接受規則、disclaimer。 */
export const NOTIFY_DISCLAIMER = '數據模型預測 僅供參考 · 理性投注';
export const NOTIFY_EVENT_TYPES = ['lock_complete', 'top4_lock', 'daily_pnl'] as const;
export type NotifyEventType = (typeof NOTIFY_EVENT_TYPES)[number];

export type NotifyFeedEvent = {
  event_key: string;
  type: NotifyEventType | string;
  meeting_date?: string | null;
  venue?: string | null;
  race_number?: number | null;
  horse_id?: string | null;
  payload?: Record<string, unknown>;
  created_at: string;
};

export type NotifyPrefsFlags = {
  lock_complete_enabled?: boolean | null;
  top4_lock_enabled?: boolean | null;
  daily_pnl_enabled?: boolean | null;
  telegram_enabled?: boolean | null;
  push_enabled?: boolean | null;
};

/** hasPro=false 唔派（free_stage／Pro／admin 由 membership_entitlement 當 hasPro=true）。 */
export function acceptsNotifyEvent(
  type: string,
  prefs: NotifyPrefsFlags,
  hasPro: boolean,
): boolean {
  if (!hasPro) return false;
  if (type === 'lock_complete') return !!prefs.lock_complete_enabled;
  if (type === 'top4_lock') return !!prefs.top4_lock_enabled;
  if (type === 'daily_pnl') return !!prefs.daily_pnl_enabled;
  return false;
}

export function venueLabel(venue: string | null | undefined): string {
  if (venue === 'ST') return '沙田';
  if (venue === 'HV') return '跑馬地';
  return venue || '';
}

/** Telegram／紀錄用標題；永遠附免責，唔用必中／穩膽，唔提命中率／回報％。 */
export function notifyEventMessage(event: NotifyFeedEvent, horseName?: string | null): {
  title: string;
  body: string;
  text: string;
  url: string;
} {
  const p = event.payload ?? {};
  const date = String(p['date'] ?? event.meeting_date ?? '');
  const venue = venueLabel(String(p['venue'] ?? event.venue ?? ''));
  const disclaimer = NOTIFY_DISCLAIMER;

  if (event.type === 'lock_complete') {
    const title = '🔒 賽前預測已鎖定';
    const body = `${date} ${venue} 最終版已凍結`.trim();
    return {
      title,
      body: `${body} · ${disclaimer}`,
      text: `${title}\n${body}\n完整分析：https://tianxi.racing/cards\n${disclaimer}`,
      url: '/cards',
    };
  }

  if (event.type === 'top4_lock') {
    const race = p['raceNumber'] ?? event.race_number;
    const num = p['horseNumber'];
    const name = horseName || (typeof p['nameCh'] === 'string' ? p['nameCh'] : null) || event.horse_id || '愛駒';
    const title = '🐎 愛駒入四揀';
    const body = `${date} ${venue} 第${race}場${num != null ? ` #${num}` : ''} ${name}（鎖定最終版）`.trim();
    return {
      title,
      body: `${body} · ${disclaimer}`,
      text: `${title}\n${body}\n詳情：https://tianxi.racing/my-horses\n${disclaimer}`,
      url: '/my-horses',
    };
  }

  // daily_pnl
  const net = Number(p['net']);
  const netLabel = Number.isFinite(net) ? (net >= 0 ? `+$${net}` : `-$${Math.abs(net)}`) : '—';
  const racesBet = p['racesBet'];
  const title = '📊 官方策略當日盈虧';
  const body = `${date} ${venue} 淨額 ${netLabel}${racesBet != null ? `（${racesBet} 場）` : ''}`.trim();
  return {
    title,
    body: `${body} · ${disclaimer}`,
    text: `${title}\n${body}\n詳情：https://tianxi.racing/strategy-pnl\n${disclaimer}`,
    url: '/strategy-pnl',
  };
}

/** 單元測試用：draft／非 final 嘅 top4 唔應該出現喺 feed；呢度再擋一層。 */
export function isDeliverableTop4(event: NotifyFeedEvent): boolean {
  if (event.type !== 'top4_lock') return true;
  const edition = event.payload?.['edition'];
  // Worker 只會喺 final 寫入；若 payload 明示 draft／unavailable 就拒。
  if (edition === 'draft' || edition === 'unavailable') return false;
  return !!event.event_key.startsWith('top4_lock:');
}
