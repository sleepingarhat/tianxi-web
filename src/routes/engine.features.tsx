import { FeaturePageGate } from "@/components/tx/gates/FeaturePageGate";
// 天喜 · 特徵選取表：全部特徵、採用狀態、模型重要度、未採用原因
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { TxBar } from "@/components/tx/viz";
import { AppShell } from "@/components/tx/AppShell";
import { EnginePipeline } from "@/components/tx/EnginePipeline";
import { Card, Disclaimer, PageHead, Pill, Stat, StatGrid } from "@/components/tx/ui";
import {
  FEATURE_CATALOG,
  FEATURE_STATS,
  GROUP_LABEL,
  SOURCE_LABEL,
  STATUS_LABEL,
  type FeatureGroup,
  type FeatureStatus,
} from "@/lib/feature-catalog";

export const Route = createFileRoute("/engine/features")({
  head: () => ({
    meta: [
      { title: "特徵選取表 · 天喜預測引擎 TIANXI" },
      {
        name: "description",
        content:
          "天喜預測引擎全部特徵因子公開：已採用 52 項及其模型重要度、未採用因子與原因（回測未過關／會偷答案／覆蓋不足），逐項白話解釋。",
      },
      { property: "og:title", content: "特徵選取表 · 天喜預測引擎" },
      { property: "og:description", content: "引擎用咗咩、冇用咩、為什麼，全部逐項列明。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <FeaturePageGate min="registered" title="特徵選取表"><FeatureCatalogPage /></FeaturePageGate>,
});

const STATUS_TONE: Record<FeatureStatus, "win" | "gold" | "ink"> = {
  adopted: "win",
  pending: "gold",
  never: "ink",
};

const FILTERS: { id: "all" | FeatureStatus; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "adopted", label: "已採用" },
  { id: "pending", label: "未採用" },
  { id: "never", label: "永不採用" },
];

function FeatureCatalogPage() {
  const [filter, setFilter] = useState<"all" | FeatureStatus>("all");
  const [sortByGain, setSortByGain] = useState(true);

  const groups = useMemo(() => {
    const rows = FEATURE_CATALOG.filter((f) => filter === "all" || f.status === filter);
    const map = new Map<FeatureGroup, typeof rows>();
    for (const r of rows) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)?.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        sortByGain ? (b.gain ?? -1) - (a.gain ?? -1) : a.zh.localeCompare(b.zh, "zh-Hant"),
      );
    }
    // 組別按組內最高重要度排
    return [...map.entries()].sort(
      (a, b) => Math.max(...b[1].map((x) => x.gain ?? 0)) - Math.max(...a[1].map((x) => x.gain ?? 0)),
    );
  }, [filter, sortByGain]);

  return (
    <AppShell page="engine" ticker="特徵選取表 · 引擎用咗咩、冇用咩，全部公開">
      <PageHead
        en="Feature Catalog"
        title="特徵選取表"
        desc="天喜預測引擎全部特徵因子逐項列明：已採用者附模型重要度，未採用者附原因。唔係越多特徵越好——加錯特徵會令命中率下跌，所以每一項都要過回測。"
      />

      <Card title="總覽" en="Overview">
        <StatGrid cols={4}>
          <Stat label="目錄總數" value={FEATURE_STATS.total} sub="項因子" />
          <Stat label="已採用" value={FEATURE_STATS.adopted} sub="天喜LGB 生產" />
          <Stat label="未採用" value={FEATURE_STATS.pending} sub="回測未過關" />
          <Stat label="永不採用" value={FEATURE_STATS.never} sub="偷答案／重複" />
        </StatGrid>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-2">
          實例：休賽復出一組 8 項因子開發完成後回測，非開鑼日前三命中由 87.2% 跌到 84.8%，所以至今未上線，仍在做開鑼日專屬驗證。市場賠率係刻意零權重，只作對照顯示。
        </p>
      </Card>

      <Card
        title="逐項清單"
        en="All Features"
        action={
          <button
            type="button"
            onClick={() => setSortByGain((v) => !v)}
            className="text-[11px] font-bold text-gold"
          >
            {sortByGain ? "按重要度" : "按名稱"} ⇅
          </button>
        }
      >
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={
                filter === f.id
                  ? "rounded-full border border-brown bg-brown px-2.5 py-1 text-[11px] font-bold text-paper"
                  : "rounded-full border border-hairline bg-paper px-2.5 py-1 text-[11px] text-ink-3"
              }
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {groups.map(([g, rows]) => (
            <section key={g}>
              <h3 className="mb-1.5 flex items-baseline gap-2 border-b border-hairline pb-1 font-serif-tc text-[13px] font-bold text-brown">
                {GROUP_LABEL[g]}
                <span className="tabnum font-mono-tx text-[9px] font-bold text-ink-3">{rows.length} 項</span>
              </h3>
              <div className="space-y-1.5">
                {rows.map((f) => {
                  const w = f.gain ? Math.max(2, Math.round((f.gain / FEATURE_STATS.maxGain) * 100)) : 0;
                  return (
                    <div key={f.id} className="rounded-[8px] border border-hairline bg-paper px-2.5 py-2">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-serif-tc text-[12.5px] font-bold leading-tight text-ink">
                            {f.zh}
                            <span className="ml-1.5 font-mono-tx text-[9px] font-normal text-ink-3">{f.id}</span>
                          </p>
                          <p className="mt-0.5 text-[10.5px] leading-relaxed text-ink-2">{f.note}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <Pill tone={STATUS_TONE[f.status]}>{STATUS_LABEL[f.status]}</Pill>
                          <p className="mt-1 font-mono-tx text-[9px] leading-none text-ink-3">
                            {SOURCE_LABEL[f.source]}
                          </p>
                        </div>
                      </div>
                      {f.status === "adopted" ? (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="min-w-0 flex-1">
                            <TxBar ratio={w / 100} tone="gold" height={5} />
                          </div>
                          <span className="tabnum shrink-0 font-mono-tx text-[9px] leading-none text-ink-3">
                            重要度 {f.gain ?? 0}
                          </span>
                        </div>
                      ) : f.reason ? (
                        <p className="mt-1.5 border-t border-hairline pt-1.5 text-[10px] leading-relaxed text-ink-3">
                          原因：{f.reason}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </Card>

      <Card title="引擎出預測流程" en="Engine Pipeline">
        <p className="mb-2 text-[11px] leading-relaxed text-ink-2">
          由收料到鎖定共八步，逐步展開睇白話解釋，並標明呢一步會唔會改動最終四揀。
        </p>
        <EnginePipeline />
      </Card>

      <Card title="相關頁面" en="Related">
        <div className="flex flex-wrap gap-2">
          <Link
            to="/features"
            className="rounded-[8px] border border-gold-strong/50 bg-gold-bg px-3 py-2 text-[12px] font-bold text-gold"
          >
            十項因子排序表 →
          </Link>
          <Link
            to="/engine"
            className="rounded-[8px] border border-hairline bg-paper px-3 py-2 text-[12px] font-bold text-ink-2"
          >
            引擎架構與對賬 →
          </Link>
          <Link
            to="/predictor"
            className="rounded-[8px] border border-hairline bg-paper px-3 py-2 text-[12px] font-bold text-ink-2"
          >
            選馬神器 →
          </Link>
        </div>
      </Card>

      <Disclaimer />
    </AppShell>
  );
}
