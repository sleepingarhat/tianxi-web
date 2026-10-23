import { Pill } from "@/components/tx/ui";
import type { Tier } from "@/lib/tiers";
export function TierBadge({ tier }: { tier: Tier }) {
  return <Pill tone={tier === "pro" ? "gold" : "ink"}>{tier === "pro" ? "Pro" : tier === "registered" ? "註冊會員" : "遊客"}</Pill>;
}