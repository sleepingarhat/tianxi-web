import type { ReactNode } from "react";
import { AppShell } from "../AppShell";
import { PageHead } from "../ui";
import { TierGate } from "./TierGate";
import { useTier } from "@/lib/useTier";

/** Protected page components mount only after tier verification, including on SSR. */
export function FeaturePageGate({
  min,
  title,
  children,
  preview,
}: {
  min: "registered" | "pro";
  title: string;
  children: ReactNode;
  preview?: ReactNode;
}) {
  const tier = useTier();
  // loading 時唔好誤顯 Membership eyebrow（會令功能頁工具「入唔到」）
  if (tier.loading) {
    return (
      <AppShell columns={false}>
        <div className="m-4 h-32 animate-pulse rounded-[4px] bg-paper-2" aria-label="讀取會籍中" />
      </AppShell>
    );
  }
  if (tier.has(min)) return <>{children}</>;
  return (
    <AppShell columns={false}>
      <PageHead en="Membership" title={title} />
      <TierGate min={min} feature={title} mode={preview ? "preview" : "lock"} preview={preview}>
        {null}
      </TierGate>
    </AppShell>
  );
}
