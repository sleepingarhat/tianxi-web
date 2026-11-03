import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, ErrorNote, Loading, PageHead, Pill, Stat, StatGrid } from "@/components/tx/ui";
import { getAuditDashboard } from "@/lib/racing-audit.functions";

export const Route = createFileRoute("/engine/audit")({
  head: () => ({
    meta: [
      { title: "完整性審計與閘結果 · 天喜 TIANXI" },
      { name: "description", content: "賽馬數據完整性審計、引擎健康閘同最近一次重訓閘結果，每日自動更新，顯示 PASS／WATCH／FAIL。" },
      { property: "og:title", content: "完整性審計與閘結果 · 天喜 TIANXI" },
      { property: "og:description", content: "數據完整性、引擎健康閘、重訓閘，PASS／WATCH／FAIL 每日公開。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuditPage,
});

const tone = (s?: string | null) => (s === "PASS" ? "win" : s === "FAIL" ? "lose" : s ? "gold" : "ink") as "win" | "lose" | "gold" | "ink";
const CAT: Record<string, string> = {
  race_artefacts: "賽日檔案（賽果／評述／派彩／分段／片段）", fixtures_cache: "賽期表", horse_profiles: "馬匹資料",
  horse_form_records: "馬匹往績", jockey_profiles: "騎師資料", jockey_records: "騎師紀錄", trainer_profiles: "練馬師資料",
  trainer_records: "練馬師紀錄", trial_results: "試閘結果", entries_upcoming: "下一賽日排位表",
};

function AuditPage() {
  const q = useQuery({ queryKey: ["audit-dashboard"], queryFn: () => getAuditDashboard(), staleTime: 300_000 });
  const d = q.data;
  return (
    <AppShell page="engine" ticker="完整性審計 · 每日自動更新">
      <PageHead en="Integrity Audit & Gates" title="完整性審計與閘結果" desc="三層公開檢查並排：數據完整性審計、引擎健康閘、最近一次重訓閘。全部直接讀每日自動產生嘅報告原檔，唔經人手改寫。" />
      <div className="mx-4 mt-3 flex flex-wrap gap-3 text-[11px] font-bold text-gold">
        <Link to="/engine/monitor">引擎監控清單 →</Link><Link to="/racing-health">後端任務健康 →</Link><Link to="/track-record">公開戰績 →</Link>
      </div>
      {q.isLoading ? <Loading label="讀取審計報告…" /> : q.error ? <div className="mx-4 mt-3"><ErrorNote error={q.error} /></div> : d ? <>
        <div className="mx-4 mt-3">
          <StatGrid cols={3}>
            <Stat label="數據完整性" value={<Pill tone={tone(d.integrity?.status)}>{d.integrity?.status ?? "未讀到"}</Pill>} sub={d.integrity ? `${d.integrity.scanDate} · 嚴重 ${d.integrity.critical}／提示 ${d.integrity.warn}` : "—"} />
            <Stat label="引擎健康閘" value={<Pill tone={tone(d.health?.overall)}>{d.health?.overall ?? "未讀到"}</Pill>} sub={d.health ? `${d.health.counts.pass} 過／${d.health.counts.watch} 留意／${d.health.counts.fail} 失敗` : "—"} />
            <Stat label="最近重訓閘" value={<Pill tone={tone(d.retrain?.gate_status)}>{d.retrain?.gate_status ?? "未記錄"}</Pill>} sub={d.retrain ? `${d.retrain.model_version.replace("lgb-ensemble-", "")} · 生效α ${d.retrain.live_alpha ?? "—"}` : "—"} />
          </StatGrid>
        </div>
        <div className="lg:grid lg:grid-cols-2">
          <Card title="數據完整性審計" en={`Integrity · ${d.integrity?.scanDate ?? "—"}`}>
            <p className="mb-2 text-[11px] leading-relaxed text-ink-3">ok＝PASS、warn＝WATCH、critical＝FAIL，直接對應審計原檔 severity。缺項只列頭 8 個。</p>
            <ul>{d.integrity?.categories.map((c) => (
              <li key={c.key} className="border-b border-hairline py-2 last:border-b-0">
                <p className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="text-[12px] font-bold text-ink">{CAT[c.key] ?? c.key}</span><Pill tone={tone(c.status)}>{c.status}</Pill></p>
                <p className="tabnum mt-0.5 font-mono-tx text-[11px] text-ink-3">應有 {c.expected} · 現有 {c.present}{c.stale ? ` · 過期 ${c.stale}` : ""}{c.note ? ` · ${c.note}` : ""}</p>
                {c.missing.length ? <p className="mt-0.5 break-words font-mono-tx text-[11px] text-lose">缺：{c.missing.join("、")}</p> : null}
              </li>))}</ul>
            <p className="mt-3 text-[11px] font-bold text-ink">近 14 日</p>
            <div className="mt-1 flex flex-wrap gap-1">{d.history.map((h) => <span key={h.date} title={`嚴重 ${h.critical}／提示 ${h.warn}`}><Pill tone={tone(h.status)}>{h.date.slice(5)} {h.status}</Pill></span>)}</div>
          </Card>
          <Card title="引擎健康閘" en={`Engine Health · ${d.health?.generatedHKT ?? "—"}`}>
            <ul>{d.health?.checks.map((c) => (
              <li key={c.id} className="border-b border-hairline py-2 last:border-b-0">
                <p className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><span className="text-[12px] font-bold text-ink">{c.label}</span><Pill tone={tone(c.status)}>{c.status}</Pill></p>
                {c.detail ? <p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{c.detail}</p> : null}
              </li>))}</ul>
            {d.retrain ? <div className="mt-3 rounded-[6px] border border-hairline bg-paper p-2 text-[11px] leading-relaxed text-ink-2">
              <p className="font-bold text-ink">最近重訓：{d.retrain.model_version}</p>
              <p className="tabnum font-mono-tx">訓練窗口 {d.retrain.training_start ?? "—"} 至 {d.retrain.training_end ?? "—"} · {d.retrain.training_rows?.toLocaleString() ?? "—"} 行</p>
              <p className="break-all font-mono-tx">指紋 {d.retrain.bundle_fingerprint ?? "未記錄"}</p>
            </div> : null}
          </Card>
        </div>
      </> : null}
      <Disclaimer />
    </AppShell>
  );
}
