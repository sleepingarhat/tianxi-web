import type { ReactNode } from "react";
import { useTier } from "@/lib/useTier";
import { UpgradeCard } from "./UpgradeCard";

/** Denied children never enter the DOM. Any teaser must be independently public data. */
export function TierGate({ min, feature, children, preview, mode = "lock", previewHeight = 160 }: { min: "registered" | "pro"; feature: string; children: ReactNode; preview?: ReactNode; mode?: "lock" | "preview"; previewHeight?: number }) {
  const state = useTier();
  if (state.loading) return <div className="h-32 animate-pulse bg-paper-2" aria-label="讀取會籍中" />;
  if (state.has(min)) return <>{children}</>;
  // Only independently public preview data is accepted; denied children are never rendered.
  return <>{mode === "preview" && preview && <div inert className="pointer-events-none overflow-hidden opacity-60" style={{ maxHeight: Math.max(0, previewHeight) }} aria-hidden="true">{preview}</div>}<UpgradeCard need={min} feature={feature} /></>;
}