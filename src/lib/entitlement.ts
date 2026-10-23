import { FOUNDING_PRO_WEEKS, DEFAULT_PAYWALL_THRESHOLD, FOUNDING_SLOTS } from "./freeStage";

export type SubRow = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

export type MembershipInput = {
  rank: number | null;
  total: number;
  gateOpenAt: string | null;
  subscription: SubRow | null;
  threshold?: number;
  foundingSlots?: number;
  cryptoPassUntil?: string | null;
  now?: Date;
};

export type Entitlement =
  | { kind: "free_stage"; hasPro: true; remaining: number }
  | { kind: "founding"; hasPro: true; until: string }
  | { kind: "founding_expired"; hasPro: false; until: string }
  | { kind: "subscribed"; hasPro: true; until: string | null; cancelAtPeriodEnd: boolean }
  | { kind: "crypto_pass"; hasPro: true; until: string }
  | { kind: "payment_failed"; hasPro: false }
  | { kind: "none"; hasPro: false };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function foundingUntil(gateOpenAt: string): string {
  return new Date(new Date(gateOpenAt).getTime() + FOUNDING_PRO_WEEKS * WEEK_MS).toISOString();
}

/**
 * 會籍規則（用戶拍板）：
 * - 未開閘＝限時免費，註冊會員享 Pro 功能。
 * - 註冊滿門檻人數開閘；首門檻名額自動 Pro 52 週，名額於開閘一次鎖定。
 * - 付費訂閱：取消後用到本期完結；扣款失敗即時停權。
 */
export function resolveEntitlement(input: MembershipInput): Entitlement {
  const now = input.now ?? new Date();
  const threshold = input.threshold ?? DEFAULT_PAYWALL_THRESHOLD;
  const foundingSlots = input.foundingSlots ?? FOUNDING_SLOTS;
  const sub = input.subscription;
  if (sub && ["past_due", "unpaid", "incomplete", "incomplete_expired", "paused"].includes(sub.status)) {
    return { kind: "payment_failed", hasPro: false };
  }
  if (sub) {
    const end = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const future = !end || end > now;
    if ((sub.status === "active" || sub.status === "trialing") && future) {
      return { kind: "subscribed", hasPro: true, until: sub.current_period_end, cancelAtPeriodEnd: sub.cancel_at_period_end };
    }
    if (sub.status === "canceled" && end && end > now) {
      return { kind: "subscribed", hasPro: true, until: sub.current_period_end, cancelAtPeriodEnd: true };
    }
  }
  if (input.cryptoPassUntil && new Date(input.cryptoPassUntil) > now) {
    return { kind: "crypto_pass", hasPro: true, until: input.cryptoPassUntil };
  }
  if (!input.gateOpenAt) {
    return { kind: "free_stage", hasPro: true, remaining: Math.max(0, threshold - input.total) };
  }
  if (input.rank !== null && input.rank <= foundingSlots) {
    const until = foundingUntil(input.gateOpenAt);
    if (new Date(until) > now) return { kind: "founding", hasPro: true, until };
    if (!sub) return { kind: "founding_expired", hasPro: false, until };
  }
  return { kind: "none", hasPro: false };
}
