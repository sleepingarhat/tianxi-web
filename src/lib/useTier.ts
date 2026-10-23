import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import { TierPreviewContext } from "@/components/tx/gates/TierPreview";
import { useServerFn } from "@tanstack/react-start";
import { useAuthState } from "./useAuthState";
import { getMyTier } from "./tier.functions";
import { DEFAULT_PAYWALL_THRESHOLD, FOUNDING_SLOTS, WATCH_LIMITS } from "./freeStage";
import { tierHas, type Tier } from "./tiers";
export { useFoundingInfo } from "./founding-info";

export function useTier() {
  const previewRegistered = useContext(TierPreviewContext);
  const auth = useAuthState();
  const getFn = useServerFn(getMyTier);
  const q = useQuery({ queryKey: ["tier"], queryFn: () => getFn(), enabled: auth.signedIn === true, staleTime: 60_000 });
  const loading = auth.signedIn === null || (auth.signedIn === true && q.isPending);
  const tier: Tier = auth.signedIn !== true || !q.data ? "guest" : previewRegistered ? "registered" : q.data.tier;
  return { tier, loading, error: q.error, signedIn: auth.signedIn === true, isAdmin: q.data?.isAdmin ?? false, gateOpen: q.data?.gateOpen ?? false, entitlementKind: q.data?.entitlementKind ?? null, total: q.data?.total ?? null, threshold: q.data?.threshold ?? DEFAULT_PAYWALL_THRESHOLD, foundingSlots: q.data?.foundingSlots ?? FOUNDING_SLOTS, remaining: q.data?.remaining ?? null, watchLimit: q.data?.watchLimit ?? WATCH_LIMITS.registered, has: (min: Tier) => !loading && !q.error && tierHas(tier,min) };
}