import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { EnginePipeline } from "@/components/tx/EnginePipeline";

import {
  Card,
  Disclaimer,
  ErrorNote,
  Loading,
  PageHead,
  Pill,
  Stat,
  StatGrid,
} from "@/components/tx/ui";
import { pctRate, txApi } from "@/lib/tx-api";

export const Route = createFileRoute("/engine/")({
  head: () => ({
    meta: [
      { title: "預測引擎 TX-Oracle v3 · 天喜 TIANXI" },
      {
        name: "description",
        content: "TX-Oracle v3 兩層集成架構：LightGBM LambdaRank 排序 + 天喜Elo v12 後備，健康閘控制混合權重，命中率公開對賬。",
      },
      { property: "og:title", content: "預測引擎 TX-Oracle v3 · 天喜 TIANXI" },
      { property: "og:description", content: "可驗證的賽事前預測與模型架構說明。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EnginePage,
});

const PAPERS = [
  {
    year: "2025",
    title: "Learning-to-Rank（韓國馬事會數據）",
    note: "呢篇論文用韓國賽馬數據比較唔同 AI 排名方法。我哋採納咗佢嘅 LambdaRank——即係直接教電腦「邊匹應該排前過邊匹」，正正係天喜LGB而家用緊嘅方法。",
    reject: "論文話另一個方法（CatBoost）喺某個評分指標（NDCG）高少少，但我哋拒絕跟住換——因為嗰個指標唔等於真實命中，唔值得為咗佢換晒成條生產線。",
  },
  {
    year: "2024",
    title: "首爾騎師 LTR 對照",
    note: "呢篇研究話：預測賽馬名次，用「排名學習」（逐對馬比較邊個應該排前）好過用「估完賽時間」再排序。我哋採納咗呢個方向，所以天喜LGB係排名次、唔係估時間。",
  },
  {
    year: "2023",
    title: "天喜Elo 於賽馬評分之應用",
    note: "我哋自己嘅做法：馬匹實力用 Elo 評分制（贏強敵加多啲分、輸俾弱旅扣多啲），馬、騎師、練馬師三個評分按 70／20／10 混合。呢個比例經過 865 場回測驗證，另外加檔位同負磅修正做獨立後備。",
  },
];

function EnginePage() {
  const roll = useQuery({ queryKey: ["hitRateRollup", 90], queryFn: () => txApi.hitRateRollup(90) });
  const s = roll.data?.summary || roll.data;

  return (
    <AppShell page="engine" ticker="TX-Oracle v3.2 · 兩層集成 · 健康閘運行中">
      <PageHead
        en="Prediction engine"
        title="預測引擎 TX-Oracle v3"
        desc="可驗證的賽事前預測：同一場出賽名單內排序，賽後用官方名次對賬。"
      />

      <Card
        title="引擎出預測流程"
        en="Pipeline"
        action={
          <Link to="/engine/features" className="text-[11px] font-bold text-gold">
            特徵選取表 →
          </Link>
        }
      >
        <p className="mb-2 text-[11px] leading-relaxed text-ink-2">
          由排位表收料到首場開跑前 90 分鐘鎖全日，共八步。逐步展開睇白話解釋，並標明呢一步會唔會改動最終版四揀。
        </p>
        <EnginePipeline />
      </Card>

      <Card title="運作模式 · 初版／最終版" en="Draft / final">

        <p className="mb-2 text-[12px] text-ink-2">
          每輪公開預測必須標明係未鎖初版定已鎖最終版。命中率只對最終版。
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[8px] border border-hairline bg-paper-2 p-2.5">
            <Pill>初版</Pill>
            <p className="mt-1 text-[11px] text-ink-3">未鎖 · 刷新可改四揀</p>
          </div>
          <div className="rounded-[8px] border border-gold-strong/50 bg-gold-bg p-2.5">
            <Pill tone="gold">最終版</Pill>
            <p className="mt-1 text-[11px] text-ink-3">已鎖 · 對賬同卡同一套</p>
          </div>
        </div>
      </Card>

      <Card
        title="實戰命中率 · 過去 90 日"
        en="Verified hit rate"
        action={
          <Link to="/track-record" className="text-[11px] font-bold text-gold">
            完整戰績 →
          </Link>
        }
      >
        {roll.isLoading ? (
          <Loading />
        ) : roll.error ? (
          <ErrorNote error={roll.error} />
        ) : (
          <StatGrid cols={3}>
            <Stat label="四揀平均中" value={s?.top4AvgIntersect ?? "—"} sub="／4 匹" />
            <Stat label="三甲任中" value={pctRate(s?.top3AnyHitRate)} sub={`${s?.top3AnyHits ?? 0} 次`} />
            <Stat label="位置Q" value={pctRate(s?.qpHitRate)} sub={`${s?.qpHits ?? 0} 次`} />
            <Stat label="三重彩" value={pctRate(s?.trioHitRate)} sub={`${s?.trioHits ?? 0} 次`} />
            <Stat label="四重彩" value={pctRate(s?.first4HitRate)} sub={`${s?.first4Hits ?? 0} 次`} />
            <Stat label="已評賽事" value={s?.racesEvaluated ?? "—"} sub="最終版" />
          </StatGrid>
        )}
      </Card>

      <Card
        title="引擎健康 · 逐項守門"
        en="Health gates"
        action={
          <Link to="/engine/monitor" className="text-[11px] font-bold text-gold">
            監控清單 →
          </Link>
        }
      >
        <p className="text-[12px] text-ink-2">
          同數據庫 sanity 同一種清單：PASS／WATCH／FAIL。閘未過關時只採用 天喜Elo 後備模型。
        </p>
      </Card>

      <Card title="模型架構（文字）" en="Architecture">
        <ul className="space-y-2 text-[12px] text-ink-2">
          <li>
            <b className="font-serif-tc text-ink">LightGBM LambdaRank</b> —— 把同一場出賽馬列為一條排序名單，學習場內相對名次；不是預測完賽時間（秒數）。
          </li>
          <li>
            <b className="font-serif-tc text-ink">天喜Elo v12</b> —— 馬匹／騎師／練馬師權重 70／20／10，再加檔位與負磅修正；作為獨立後備模型。
          </li>
          <li>
            <b className="font-serif-tc text-ink">機率混合</b> —— 按健康閘的 α 加權兩層輸出。閘未過關時只採用 天喜Elo。
          </li>
          <li>
            <b className="font-serif-tc text-ink">臨場獨贏賠率</b> —— 只顯示於選馬頁作對照，不進入 LambdaRank。
          </li>
        </ul>
        <pre className="tabnum mt-3 overflow-x-auto rounded-[8px] border border-hairline bg-paper-3 p-2.5 font-mono-tx text-[11px] text-ink-2">
{`p = α · softmax(天喜LGB / τ_lgb) + (1−α) · softmax(天喜Elo / τ_elo)
閘 FAIL ⇒ α = 0（純 天喜Elo）`}
        </pre>
      </Card>

      <Card title="論文同論證" en="Research">
        <p className="mb-2 text-[12px] text-ink-2">
          我哋會睇學術論文同研究，核實過先決定採納定拒絕，全部寫明原因。
        </p>
        <div className="divide-y divide-hairline">
          {PAPERS.map((p) => (
            <div key={p.title} className="py-2">
              <div className="flex items-center gap-2">
                <span className="tabnum font-mono-tx text-[11px] font-bold text-gold">{p.year}</span>
                <span className="font-serif-tc text-[12px] font-bold">{p.title}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed text-ink-2">{p.note}</p>
              {"reject" in p && p.reject ? (
                <p className="mt-1 text-[11px] leading-relaxed text-ink-3">
                  <span className="font-bold text-gold">拒絕咗嘅：</span>
                  {p.reject}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <Card title="更多" en="More">
        <div className="flex flex-wrap gap-2 text-[12px] font-bold text-gold">
          <Link to="/manual">說明書 →</Link>
          <Link to="/dev-log">開發者日誌 →</Link>
          <Link to="/predictor">選馬工具 →</Link>
          <Link to="/strategy-pnl">策略盈虧 →</Link>
          <Link to="/explain">四揀覆蓋解釋 →</Link>
        </div>
      </Card>

      <Disclaimer />
    </AppShell>
  );
}
