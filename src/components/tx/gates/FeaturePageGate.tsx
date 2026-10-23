import type { ReactNode } from "react";
import { AppShell } from "../AppShell";
import { PageHead } from "../ui";
import { TierGate } from "./TierGate";
import { useTier } from "@/lib/useTier";

/** Protected page components mount only after tier verification, including on SSR. */
export function FeaturePageGate({ min, title, children, preview }: { min: "registered" | "pro"; title: string; children: ReactNode; preview?: ReactNode }) {
  const tier = useTier();
  if (tier.has(min)) return <>{children}</>;
  return <AppShell columns={false}><PageHead en="Membership" title={title} /><TierGate min={min} feature={title} mode={preview ? "preview" : "lock"} preview={preview}>{null}</TierGate></AppShell>;
}