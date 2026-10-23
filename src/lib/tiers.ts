export type Tier = "guest" | "registered" | "pro";
const order: Record<Tier, number> = { guest: 0, registered: 1, pro: 2 };
export function tierHas(tier: Tier, min: Tier) { return order[tier] >= order[min]; }
export const FEATURE_TIERS = {
  "race.picks_full": "pro", "race.picks_top1": "registered",
  "cards.all_races": "pro", "cards.race1": "guest", "cards.other_top1": "registered",
  "predictor.full": "pro", "predictor.race1": "registered", "predictor.lab": "pro",
  "crossrace.pools": "pro", "poolodds.value": "pro",
  "explain.prerace": "pro", "explain.postrace": "registered",
  "horse.research": "registered", "horse.training_health": "registered",
  "dashboard.full": "registered", "encyclopedia.full": "registered", "engine.deep": "registered",
  "features.table": "registered", "reconcile.full": "registered", "elolog": "registered",
  "strategy": "pro", "watchlist": "registered", "alerts.raceday": "registered", "telegram.pro_channel": "pro",
} as const satisfies Record<string, Tier>;