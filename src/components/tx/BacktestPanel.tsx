import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import {
  BACKTEST_RANGE_PRESETS,
  upsertStrategy,
  type BacktestResultPayload,
  type FeatureWeightSpec,
  type PoolCode,
} from "@/lib/lab-backtest";
import { runLabBacktest, getLabBaselines } from "@/lib/lab-backtest.functions";

type Props = {
  weights: FeatureWeightSpec[];
  locked?: boolean;
};

const ALL_POOLS: PoolCode[] = ["FF", "TRIO", "TIERCE", "QUARTET"];

function SummaryRow({ title, s }: { title: string; s: BacktestResultPayload["overall"] | null | undefined }) {
  if (!s) return null;
  return (
    <div className="rounded-[4px] border border-hairline bg-paper p-2 text-[11px]">
      <div className="font-bold text-ink">{title}</div>
      <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono-tx text-ink-2">
        <span>場數 {s.raceCount}</span>
        <span>四揀均中 {s.avgTop4Hits}</span>
        {s.showRoi ? (
          <>
            <span>ROI {s.roiPct ?? "—"}%</span>
            <span>淨 {(s.net ?? 0).toLocaleString()}</span>
            <span>回撤 {s.maxDrawdown ?? "—"}</span>
          </>
        ) : (
          <span className="col-span-2">樣本不足 200，只顯示命中</span>
        )}
      </div>
    </div>
  );
}

export function BacktestPanel({ weights, locked }: Props) {
  const runFn = useServerFn(runLabBacktest);
  const baselnFn = useServerFn(getLabBaselines);
  const [preset, setPreset] = useState<(typeof BACKTEST_RANGE_PRESETS)[number]["key"]>("demo");
  const [pools, setPools] = useState<PoolCode[]>([...ALL_POOLS]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResultPayload | null>(null);
  const [compare, setCompare] = useState<any>(null);
  const [name, setName] = useState("");

  const range = BACKTEST_RANGE_PRESETS.find((p) => p.key === preset) ?? BACKTEST_RANGE_PRESETS[2];

  if (locked) {
    return (
      <div className="rounded-[4px] border border-hairline bg-paper/60 p-3 text-[12px] text-ink-2">
        <p className="font-bold text-ink">回測 · Pro 鎖定</p>
        <p className="mt-1 leading-relaxed">
          示範（已完場合成窗）：四揀均中約 1.6 匹／場；樣本 {'<'} 200 時只出命中唔出 ROI。升級 Pro 後可對自訂權重執行回測，並同官方／Elo 對照。
        </p>
      </div>
    );
  }

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const active = weights.filter((w) => w.weight > 0);
      if (!active.length) throw new Error("至少要有一項權重 > 0");
      const res = await runFn({
        data: {
          features: active,
          from: range.from,
          to: range.to,
          pools,
        },
      });
      setResult(res.result);
      const cmp = await baselnFn({ data: { from: range.from, to: range.to } });
      setCompare(cmp);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  function save() {
    const active = weights.filter((w) => w.weight > 0);
    const s = upsertStrategy({
      name: name || `策略 ${new Date().toLocaleDateString("zh-HK")}`,
      weights: active,
      pools,
    });
    setName(s.name);
    alert(`已儲存「${s.name}」v${s.version}（本機；Supabase 持久化見 migration 草稿）`);
  }

  function togglePool(p: PoolCode) {
    setPools((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {BACKTEST_RANGE_PRESETS.map((p) => (
          <Button
            key={p.key}
            type="button"
            variant={preset === p.key ? "default" : "outline"}
            size="sm"
            className="h-7 text-[11px]"
            onClick={() => setPreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {ALL_POOLS.map((p) => (
          <label key={p} className="flex items-center gap-1 text-ink-2">
            <input type="checkbox" checked={pools.includes(p)} onChange={() => togglePool(p)} />
            {p}
          </label>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || !pools.length} onClick={() => void run()}>
          {busy ? "回測中…" : "執行回測"}
        </Button>
        <input
          className="h-8 rounded-[4px] border border-hairline bg-paper px-2 text-[12px]"
          placeholder="策略名稱"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="button" variant="outline" size="sm" onClick={save}>
          儲存我的策略
        </Button>
      </div>
      {error ? <p className="text-[12px] text-red-700">{error}</p> : null}
      {result ? (
        <div className="space-y-2">
          <p className="text-[11px] text-ink-2">
            hash {result.hash.slice(0, 12)}… · 矩陣 {result.matrixSource}/{result.matrixVersion} · 研究層
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <SummaryRow title="整體（自訂）" s={result.overall} />
            <SummaryRow title="驗證段" s={result.validation} />
            <SummaryRow title="訓練段" s={result.train} />
            <SummaryRow title="官方基線" s={result.officialBaseline} />
            <SummaryRow title="純 Elo 基線" s={result.eloBaseline} />
          </div>
          {compare ? (
            <div className="rounded-[4px] border border-dashed border-gold/40 bg-gold-bg/30 p-2 text-[11px] text-ink-2">
              <div className="font-bold text-ink">基線 stub · 官方 vs Elo</div>
              <div className="mt-1 font-mono-tx">
                官方均中 {compare.official?.avgTop4Hits ?? "—"} · Elo 均中 {compare.elo?.avgTop4Hits ?? "—"}
              </div>
              <p className="mt-1">
                <Link to="/lab/compare" className="text-gold font-bold">
                  開完整比較器 →
                </Link>
              </p>
            </div>
          ) : null}
          {result.limitations?.length ? (
            <ul className="list-disc pl-4 text-[11px] text-ink-2">
              {result.limitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
