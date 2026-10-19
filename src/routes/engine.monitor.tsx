import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { ReliabilityChart } from "@/components/tx/ReliabilityChart";
import { Card, Disclaimer, ErrorNote, Loading, PageHead, Pill, Stat, StatGrid } from "@/components/tx/ui";
import { pctRate, txApi } from "@/lib/tx-api";

export const Route = createFileRoute("/engine/monitor")({
  head: () => ({
    meta: [
      { title: "引擎監控清單 · 天喜 TIANXI" },
      { name: "description", content: "引擎守門狀態與健康指標清單，與後端 ENGINE_HEALTH 報告共用同一份資料。" },
      { property: "og:title", content: "引擎監控清單 · 天喜 TIANXI" },
      { property: "og:description", content: "守門狀態 PASS／WATCH／FAIL 一覽。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MonitorPage,
});

type Gate = { key: string; label: string; status: "PASS" | "WATCH" | "FAIL"; note: string };

function gates(s: any): Gate[] {
  const n = (v: unknown) => (typeof v === "number" ? v : null);
  const gate = (v: number | null, pass: number, watch: number): Gate["status"] =>
    v == null ? "WATCH" : v >= pass ? "PASS" : v >= watch ? "WATCH" : "FAIL";
  const avg4 = n(s?.top4AvgIntersect);
  const top3 = n(s?.top3AnyHitRate);
  const races = n(s?.racesEvaluated);
  return [
    { key: "sample", label: "樣本量", status: races == null ? "WATCH" : races >= 60 ? "PASS" : races >= 20 ? "WATCH" : "FAIL", note: `已評 ${races ?? "—"} 場（門檻 60）` },
    { key: "avg4", label: "四揀平均中匹數", status: gate(avg4, 3, 2.5), note: `天喜LGB 排名預測四匹，目標平均命中三匹：${avg4 ?? "—"} / 4（目標 3.0，警戒 2.5）` },
    { key: "top3", label: "三甲任中率", status: gate(top3, 60, 45), note: `${pctRate(top3)}（門檻 60% / 45%）` },
    { key: "trio", label: "三重彩覆蓋", status: gate(n(s?.trioHitRate), 10, 5), note: `天喜LGB 四匹混合複式中三重彩，目標門檻 10%：${pctRate(s?.trioHitRate)}` },
    { key: "season", label: "賽季閘", status: races ? "PASS" : "WATCH", note: "休季期間無當日 live 曲線屬預期" },
    {
      key: "lock",
      label: "鎖點口徑",
      status: "PASS",
      note: "全日一次鎖定＝第一場開跑前 90 分鐘；鎖後只准 join 名次，公開四揀唔跟 live LGB 漂移",
    },
    {
      key: "scarce",
      label: "少仗提示",
      status: "PASS",
      note: "四揀有第一／二次出賽（出賽 ≤2）嘅馬，照列正式預測及戰績；少仗只作資料提示，不改模型、已鎖分數或四揀。缺完整凍結證據仍須阻截。",
    },
  ];
}

const TONE = { PASS: "win", WATCH: "gold", FAIL: "lose" } as const;

function MonitorPage() {
  const roll = useQuery({ queryKey: ["hitRateRollup", 90], queryFn: () => txApi.hitRateRollup(90) });
  const acc = useQuery({ queryKey: ["predictionAccuracy", 365], queryFn: () => txApi.predictionAccuracy(365) });
  const cal = useQuery({ queryKey: ["probCalibration"], queryFn: () => txApi.calibration() });
  const s = roll.data?.summary || roll.data;
  const list = gates(s);
  const base = (acc.data?.summary || []).find((v: any) => v?.variant === "baseline") || null;
  const calCur = cal.data?.current || null;
  const hold = calCur?.holdout || null;


  return (
    <AppShell page="engine" ticker="守門狀態 · PASS／WATCH／FAIL">
      <PageHead
        en="Engine Monitor"
        title="引擎監控清單"
        desc="同後端倉庫 ENGINE_HEALTH 報告、用戶端引擎頁共用一份資料。休季期間無當日 live 曲線屬預期。"
      />

      <Card title="運作模式 · 初版／最終版" en="Draft / Final">
        <p className="text-[12px] text-ink-2">
          公開四擇必須標明此輪係<b className="text-ink"> 初版 </b>定<b className="text-ink"> 最終版 </b>。已完場對賬只用最終版。
        </p>
      </Card>

      <Card title="守門狀態" en="Gates">
        {roll.isLoading ? (
          <Loading />
        ) : roll.error ? (
          <ErrorNote error={roll.error} />
        ) : (
          <div className="divide-y divide-hairline">
            {list.map((g) => (
              <div key={g.key} className="flex items-center gap-2 py-2.5">
                <div className="flex-1">
                  <p className="font-serif-tc text-[13px] font-bold">{g.label}</p>
                  <p className="tabnum font-mono-tx text-[10px] text-ink-3">{g.note}</p>
                </div>
                <Pill tone={TONE[g.status]}>{g.status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="指標快照" en="Metrics">
        <StatGrid cols={3}>
          <Stat label="四揀平均中" value={s?.top4AvgIntersect ?? "—"} sub="／4 匹" />
          <Stat label="三甲任中" value={pctRate(s?.top3AnyHitRate)} />
          <Stat label="首四∩頭三" value={s?.top3AvgIntersect ?? "—"} />
        </StatGrid>
      </Card>

      <Card title="機率品質" en="Probability Quality" >
        {acc.isLoading ? (
          <Loading />
        ) : acc.error ? (
          <ErrorNote error={acc.error} />
        ) : !base ? (
          <p className="text-[11px] text-ink-3">近 365 日暫無已對賬的凍結預測紀錄。</p>
        ) : (
          <>
            <StatGrid cols={3}>
              <Stat label="獨贏 Brier" value={base.brierWin ?? "—"} sub="越細越好" />
              <Stat label="獨贏 Log-loss" value={base.logLossWin ?? "—"} sub="越細越好" />
              <Stat
                label="Brier 技巧分"
                value={base.brierSkillScore != null ? `${(base.brierSkillScore * 100).toFixed(1)}%` : "—"}
                sub="＞0 即勝過基準率"
              />
            </StatGrid>
            <p className="mt-2 tabnum font-mono-tx text-[10px] text-ink-3">
              樣本 {base.races ?? "—"} 場 · {base.horses ?? "—"} 匹 · 基準勝率 {base.baseWinRate ?? "—"}%
              　三甲 Brier {base.brierTop3 ?? "—"} · Log-loss {base.logLossTop3 ?? "—"}
            </p>
          </>
        )}
      </Card>

      {base ? (
        <>
          <Card title="可靠度圖 · 獨贏機率" en="Reliability · Win">
            <ReliabilityChart calib={base.calibrationWin} max={50} />
          </Card>
          <Card title="可靠度圖 · 三甲機率" en="Reliability · Top-3">
            <ReliabilityChart calib={base.calibrationTop3} max={70} />
          </Card>
        </>
      ) : null}

      <Card title="機率校準 · 三甲" en="Calibration · Top-3">
        {cal.isLoading ? (
          <Loading />
        ) : cal.error ? (
          <ErrorNote error={cal.error} />
        ) : !calCur?.top3 ? (
          <p className="text-[11px] text-ink-3">未套用校準，三甲機率為模型原始輸出。</p>
        ) : (
          <>
            <div className="mb-2 flex items-center gap-2">
              <Pill tone="win">已套用</Pill>
              <span className="tabnum font-mono-tx text-[10px] text-ink-3">
                第 {calCur.version} 版 · {String(calCur.fittedAt || "").substring(0, 10)} · 樣本 {calCur.samples ?? "—"} 匹
              </span>
            </div>
            <StatGrid cols={3}>
              <Stat label="收縮系數 a" value={calCur.top3.a} sub="＜1＝收窄過度自信" />
              <Stat label="平移 b" value={calCur.top3.b} />
              <Stat
                label="驗證集 Brier"
                value={hold?.after?.brier ?? "—"}
                sub={hold?.before?.brier != null ? `校準前 ${hold.before.brier}` : undefined}
              />
            </StatGrid>
            <p className="mt-2 tabnum font-mono-tx text-[10px] text-ink-3">
              驗證集 {hold?.after?.n ?? "—"} 匹 · Log-loss {hold?.before?.logLoss ?? "—"} → {hold?.after?.logLoss ?? "—"}
              　只調整顯示機率，嚴格單調，唔會改動任何排名或選馬次序。
            </p>
          </>
        )}
      </Card>


      <Card title="更多" en="More">
        <div className="flex gap-3 text-[12px] font-bold text-gold">
          <Link to="/engine">引擎頁 →</Link>
          <Link to="/engine/residuals">殘差診斷 →</Link>
          <Link to="/track-record">公開戰績 →</Link>
        </div>
      </Card>

      <Disclaimer />
    </AppShell>
  );
}
