import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { AppShell } from "@/components/tx/AppShell";
import { Card, ErrorNote, Loading, PageHead, Pill, Scroller, Stat, StatGrid, Table, Td } from "@/components/tx/ui";
import { getRacingHealth } from "@/lib/racingOps.functions";

export const Route = createFileRoute("/racing-health")({
  head: () => ({
    meta: [
      { title: "賽馬後端健康 · 天喜 TIANXI" },
      { name: "description", content: "賽馬後端一頁睇晒：最後一次派彩收料時間、各定時任務狀態、工作心跳、Telegram 告警通道是否接通。" },
      { property: "og:title", content: "賽馬後端健康 · 天喜 TIANXI" },
      { property: "og:description", content: "派彩收料、定時任務、工作心跳、告警通道即時狀態。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RacingHealthPage,
});

function hk(iso?: string | null) {
  if (!iso) return "—";
  return new Date(Date.parse(iso) + 8 * 3600_000).toISOString().slice(5, 16).replace("T", " ");
}
function age(h: number | null) {
  if (h == null) return "—";
  return h < 1 ? `${Math.round(h * 60)} 分鐘前` : h < 48 ? `${h.toFixed(1)} 小時前` : `${Math.round(h / 24)} 日前`;
}
const TONE = { ok: "win", warn: "gold", fail: "lose", unknown: "ink" } as const;
const TXT = { ok: "正常", warn: "停滯", fail: "失敗", unknown: "未知" } as const;

function RacingHealthPage() {
  const q = useQuery({ queryKey: ["racing-health"], queryFn: () => getRacingHealth(), refetchInterval: 60_000 });
  const d = q.data;
  const fails = d?.workflows.filter((w) => w.state === "fail").length ?? 0;
  const tgOk = !!d?.telegram.ok;

  return (
    <AppShell page="engine" ticker="賽馬後端健康 · 每分鐘自動刷新">
      <PageHead en="Racing Backend Health" title="賽馬後端健康" desc="派彩收料、定時任務、Telegram 告警通道，一頁睇晒；任何一項轉紅即時見到。" />
      {q.isLoading ? (
        <Loading label="檢查後端…" />
      ) : q.error ? (
        <div className="mx-4 mt-3"><ErrorNote error={q.error} /></div>
      ) : d ? (
        <>
          {!tgOk && (
            <div className="mx-4 mt-3 rounded-[8px] border border-lose/40 bg-lose/10 px-3 py-2 text-[12px] font-semibold text-lose">
              ⚠ Telegram 告警通道未能確認接通。
            </div>
          )}
          <div className="mx-4 mt-3">
            <StatGrid cols={3}>
              <Stat label="最後派彩收料" value={d.lastDividend?.date.slice(5) ?? "—"} sub={d.lastDividend?.committedAt ? `入倉 ${hk(d.lastDividend.committedAt)}` : "未搵到"} />
              <Stat label="定時任務" value={fails ? `${fails} 項失敗` : "全部正常"} sub={`共 ${d.workflows.length} 項`} />
              <Stat label="Telegram" value={tgOk ? "接通" : "唔通"} />
            </StatGrid>
          </div>

          <Card title="定時任務狀態" en="Scheduled Jobs">
            <Scroller>
              <Table head={["任務", "狀態", "最後運行（香港）", "距今"]}>
                {d.workflows.map((w) => (
                  <tr key={w.file} className="border-t border-hairline">
                    <Td first mono={false}>
                      <div>{w.label}</div>
                      <div className="text-[10px] text-ink-3">{w.file}</div>
                    </Td>
                    <Td mono={false}><Pill tone={TONE[w.state]}>{TXT[w.state]}</Pill></Td>
                    <Td>{hk(w.startedAt)}</Td>
                    <Td>{age(w.ageHours)}</Td>
                  </tr>
                ))}
              </Table>
            </Scroller>
          </Card>

          {d.jobTicks.length ? (
            <Card title="工作心跳（每五分鐘任務）" en="Job Heartbeats">
              <Scroller>
                <Table head={["任務", "狀態", "最後心跳（香港）", "距今"]}>
                  {d.jobTicks.map((t) => {
                    const atMs = t.at ? Date.parse(t.at) : NaN;
                    const tone = t.stale ? "lose" : t.status === "fail" ? "gold" : "win";
                    const txt = t.stale ? "停滯" : t.status === "fail" ? "上次失敗" : "正常";
                    return (
                      <tr key={t.label} className="border-t border-hairline">
                        <Td first mono={false}>
                          <div>{t.label}</div>
                        </Td>
                        <Td mono={false}><Pill tone={tone}>{txt}</Pill></Td>
                        <Td>{t.at ? hk(t.at) : "—"}</Td>
                        <Td>{Number.isFinite(atMs) ? age((Date.now() - atMs) / 3600_000) : "—"}</Td>
                      </tr>
                    );
                  })}
                </Table>
              </Scroller>
            </Card>
          ) : null}

          <Card title="告警紀錄（未恢復）" en="Open Alerts">
            {d.telegram.openAlerts ? (
              <p className="text-[11px] text-lose">{d.telegram.openAlerts} 項未恢復告警。</p>
            ) : (
              <p className="text-[11px] text-ink-3">目前冇未恢復告警。</p>
            )}
          </Card>
          <p className="mx-4 mb-4 text-[10px] text-ink-3">
            檢查時間 {hk(d.checkedAt)} · 只讀狀態，唔會發 Telegram 訊息 · <Link to="/engine/backtest" className="text-gold underline">睇引擎回測</Link>
          </p>
        </>
      ) : null}
    </AppShell>
  );
}
