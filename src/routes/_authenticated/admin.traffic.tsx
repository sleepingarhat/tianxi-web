import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { AdminHead, Kpi, NoteBox, Panel } from "@/components/admin/kit";
import { getGa4Traffic } from "@/lib/ga4.functions";
import type { Ga4TrafficReport } from "@/lib/ga4.server";
import { getMemberAccountStats } from "@/lib/members.functions";

export const Route = createFileRoute("/_authenticated/admin/traffic")({
  head: () => ({
    meta: [
      { title: "流量 · 天喜監控端" },
      { name: "description", content: "流量 · 天喜監控端：Google Analytics 4 訪客、來源、停留時間同熱門頁面。" },
      { property: "og:title", content: "流量 · 天喜監控端" },
      { property: "og:description", content: "天喜監控端流量報告。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Traffic,
});

const fmtDur = (sec: number) => {
  if (!Number.isFinite(sec) || sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m} 分 ${s} 秒` : `${s} 秒`;
};
const fmtPct = (v: number) => (Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "—");
const fmtDate = (yyyymmdd: string) => `${yyyymmdd.slice(4, 6)}/${yyyymmdd.slice(6, 8)}`;

function FunnelPanel({ data }: { data: Ga4TrafficReport | undefined }) {
  const fetchStats = useServerFn(getMemberAccountStats);
  const m = useQuery({ queryKey: ["member-stats"], queryFn: () => fetchStats(), staleTime: 5 * 60_000 });
  const ev = data?.funnel.events ?? {};
  // 漏斗主體用 GA4 事件（自動更新）；會員資料庫數喺下面對照面板並列
  const steps: { label: string; n: number | null; src: string }[] = [
    { label: "首頁訪客", n: data ? data.funnel.homeUsers : null, src: "GA4" },
    { label: "入註冊頁", n: data ? data.funnel.authUsers : null, src: "GA4" },
    { label: "提交註冊", n: data ? (ev["sign_up_start"] ?? 0) : null, src: "GA4 事件" },
    { label: "完成註冊", n: data ? (ev["sign_up"] ?? 0) : null, src: "GA4 事件" },
    { label: "首次登入", n: data ? (ev["login"] ?? 0) : null, src: "GA4 事件" },
  ];
  const top = Math.max(1, steps[0]?.n ?? 1);
  const pay = [
    { label: "撳訂閱 Pro", n: ev["begin_checkout"] ?? 0 },
    { label: "完成付款", n: ev["purchase"] ?? 0 },
  ];
  // GA 事件 vs 會員資料庫對照
  const compare: { label: string; ga: number | null; db: number | null }[] = [
    { label: "提交註冊", ga: data ? (ev["sign_up_start"] ?? 0) : null, db: m.data ? m.data.last30 : null },
    { label: "完成註冊", ga: data ? (ev["sign_up"] ?? 0) : null, db: m.data ? m.data.signedIn30 : null },
    { label: "驗證電郵", ga: null, db: m.data ? m.data.confirmed30 : null },
  ];
  // 轉換率圖表
  const rates = [
    { label: "會員註冊完成率", done: ev["sign_up"] ?? 0, start: ev["sign_up_start"] ?? 0, doneLabel: "完成註冊", startLabel: "提交註冊" },
    { label: "訂閱完成率", done: ev["purchase"] ?? 0, start: ev["begin_checkout"] ?? 0, doneLabel: "完成付款", startLabel: "撳訂閱" },
  ];
  return (
    <>
      <Panel title="會員漏斗" en="近 30 日 · GA4 事件自動更新" className="mt-4">
        <ul className="space-y-2">
          {steps.map((s, i) => {
            const prev = i > 0 ? steps[i - 1]?.n : null;
            const loss = prev && s.n != null ? 1 - s.n / prev : null;
            return (
              <li key={s.label}>
                <div className="flex items-baseline justify-between gap-2 text-[12px]">
                  <span className="text-ink">{i + 1}. {s.label}<span className="ml-1 text-[10px] text-ink-3">{s.src}</span></span>
                  <span className="font-mono-tx text-ink-2">
                    {s.n == null ? "—" : s.n.toLocaleString()}
                    {loss != null ? <span className="ml-2 text-[10px] text-ink-3">流失 {fmtPct(Math.max(0, loss))}</span> : null}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-hairline">
                  <div className="h-2 rounded-full bg-gold/80" style={{ width: `${Math.min(100, ((s.n ?? 0) / top) * 100)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 grid grid-cols-2 gap-3 border-t border-hairline pt-3 text-[12px]">
          {pay.map((p) => (
            <div key={p.label}><span className="text-ink-3">{p.label}</span><div className="font-mono-tx text-ink">{p.n.toLocaleString()} 次</div></div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-ink-3">
          訪客轉會員率：{steps[0]?.n && steps[3]?.n != null ? fmtPct(steps[3].n / steps[0].n) : "—"}；落單完成率：{pay[0]!.n ? fmtPct(pay[1]!.n / pay[0]!.n) : "—"}。GA4 事件由正式站統計碼即時記錄（廣告攔截會少計）。
        </p>
      </Panel>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="GA 事件 對照 會員資料庫" en="近 30 日">
          <ul className="divide-y divide-hairline">
            <li className="flex items-center gap-3 py-2 text-[10px] text-ink-3">
              <span className="min-w-0 flex-1">步驟</span>
              <span className="w-16 text-right">GA4 事件</span>
              <span className="w-16 text-right">會員資料</span>
            </li>
            {compare.map((c) => (
              <li key={c.label} className="flex items-center gap-3 py-2">
                <span className="min-w-0 flex-1 text-[12px] text-ink">{c.label}</span>
                <span className="w-16 text-right font-mono-tx text-[11px] text-ink-2">{c.ga == null ? "—" : c.ga.toLocaleString()}</span>
                <span className="w-16 text-right font-mono-tx text-[11px] text-ink-2">{c.db == null ? "—" : c.db.toLocaleString()}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[10px] text-ink-3">
            GA4 事件由統計碼記錄（廣告攔截會少計、有幾個鐘延遲）；會員資料係資料庫實數。兩者接近即代表追蹤正常；「驗證電郵」冇 GA 事件，只有資料庫數。
          </p>
        </Panel>

        <Panel title="轉換率" en="近 30 日 · 每步轉換">
          <ul className="space-y-4">
            {rates.map((r) => {
              const rate = r.start > 0 ? r.done / r.start : null;
              return (
                <li key={r.label}>
                  <div className="flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="text-ink">{r.label}</span>
                    <span className="font-mono-tx text-ink-2">{rate == null ? "—" : fmtPct(rate)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-hairline">
                    <div className="h-2 rounded-full bg-gold/80" style={{ width: `${rate == null ? 0 : Math.min(100, rate * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[10px] text-ink-3">
                    {r.startLabel} {r.start.toLocaleString()} 次 → {r.doneLabel} {r.done.toLocaleString()} 次
                  </p>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[10px] text-ink-3">對照上面漏斗：註冊完成率＝第 4 步 ÷ 第 3 步；訂閱完成率＝完成付款 ÷ 撳訂閱 Pro。</p>
        </Panel>
      </div>
    </>
  );
}

function Traffic() {
  const fetchTraffic = useServerFn(getGa4Traffic);
  const q = useQuery({
    queryKey: ["ga4-traffic"],
    queryFn: () => fetchTraffic(),
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  });

  const d = q.data;
  const maxViews = Math.max(1, ...(d?.daily.map((p) => p.views) ?? [1]));

  return (
    <>
      <AdminHead
        title="流量"
        en="Traffic · Google Analytics 4"
        desc="訪客數、來源、停留時間同熱門頁面；數據來自 Google Analytics 4，每 10 分鐘自動更新。"
      />
      <NoteBox tone="gold">
        數據由 Google Analytics 4 提供，會員註冊人數請睇「會員」頁。GA4 數據通常有幾個鐘延遲，「而家在線」係即時數字。
      </NoteBox>

      {q.isError ? (
        <div className="mt-4">
          <NoteBox tone="gold">
            讀取失敗：{(q.error as Error)?.message || "請稍後重試"}。如果係第一次設定，Google Analytics 可能要等 24–48 個鐘先開始有數據。
          </NoteBox>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="而家在線" value={q.isLoading ? "—" : d?.realtimeUsers == null ? "—" : d.realtimeUsers.toLocaleString()} sub="過去 30 分鐘" tone="gold" />
        <Kpi label="今日訪客" value={q.isLoading ? "—" : (d?.today.users ?? 0).toLocaleString()} sub={`${(d?.today.views ?? 0).toLocaleString()} 次瀏覽`} />
        <Kpi label="近 7 日訪客" value={q.isLoading ? "—" : (d?.last7.users ?? 0).toLocaleString()} sub={`${(d?.last7.sessions ?? 0).toLocaleString()} 個工作階段`} />
        <Kpi label="近 30 日訪客" value={q.isLoading ? "—" : (d?.last30.users ?? 0).toLocaleString()} sub={`${(d?.last30.views ?? 0).toLocaleString()} 次瀏覽`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="平均停留（7 日）" value={q.isLoading ? "—" : fmtDur(d?.last7.avgDurationSec ?? 0)} />
        <Kpi label="跳出率（7 日）" value={q.isLoading ? "—" : fmtPct(d?.last7.bounceRate ?? 0)} sub="睇一頁就走嘅比例" />
        <Kpi label="平均停留（30 日）" value={q.isLoading ? "—" : fmtDur(d?.last30.avgDurationSec ?? 0)} />
        <Kpi label="跳出率（30 日）" value={q.isLoading ? "—" : fmtPct(d?.last30.bounceRate ?? 0)} />
      </div>

      <Panel title="每日瀏覽趨勢" en="近 30 日" className="mt-4">
        {q.isLoading ? (
          <p className="py-6 text-center text-[12px] text-ink-3">讀取中…</p>
        ) : !d?.daily.length ? (
          <p className="py-6 text-center text-[12px] text-ink-3">暫時未有數據</p>
        ) : (
          <div className="flex h-32 items-end gap-[3px]">
            {d.daily.map((p) => (
              <div key={p.date} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end" title={`${fmtDate(p.date)}：${p.views} 次瀏覽／${p.users} 訪客`}>
                <div className="w-full rounded-t-[3px] bg-gold/80 transition-colors group-hover:bg-gold" style={{ height: `${Math.max(2, (p.views / maxViews) * 100)}%` }} />
              </div>
            ))}
          </div>
        )}
        {d?.daily.length ? (
          <div className="mt-1 flex justify-between font-mono-tx text-[10.5px] text-ink-3">
            <span>{fmtDate(d.daily.at(0)?.date ?? "")}</span>
            <span>{fmtDate(d.daily.at(-1)?.date ?? "")}</span>
          </div>
        ) : null}
      </Panel>

      <FunnelPanel data={d} />

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="訪客來源" en="近 30 日">
          {q.isLoading ? (
            <p className="py-6 text-center text-[12px] text-ink-3">讀取中…</p>
          ) : !d?.sources.length ? (
            <p className="py-6 text-center text-[12px] text-ink-3">暫時未有數據</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {d.sources.map((s) => (
                <li key={s.source} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{s.source}</span>
                  <span className="font-mono-tx text-[11px] text-ink-2">{s.sessions.toLocaleString()} 次</span>
                  <span className="w-16 text-right font-mono-tx text-[11px] text-ink-3">{fmtDur(s.avgDurationSec)}</span>
                  <span className="w-14 text-right font-mono-tx text-[11px] text-ink-3">{fmtPct(s.bounceRate)}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-[10px] text-ink-3">欄目：工作階段數 ／ 平均停留 ／ 跳出率</p>
        </Panel>

        <Panel title="最多人睇嘅頁面" en="近 30 日">
          {q.isLoading ? (
            <p className="py-6 text-center text-[12px] text-ink-3">讀取中…</p>
          ) : !d?.pages.length ? (
            <p className="py-6 text-center text-[12px] text-ink-3">暫時未有數據</p>
          ) : (
            <ul className="divide-y divide-hairline">
              {d.pages.map((p) => (
                <li key={`${p.path}|${p.title}`} className="flex items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] text-ink">{p.title || p.path}</span>
                    <span className="block truncate font-mono-tx text-[10px] text-ink-3">{p.path}</span>
                  </span>
                  <span className="font-mono-tx text-[11px] text-ink-2">{p.views.toLocaleString()} 次</span>
                  <span className="w-14 text-right font-mono-tx text-[11px] text-ink-3">{p.users.toLocaleString()} 人</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {d ? (
        <p className="mt-3 text-right font-mono-tx text-[10px] text-ink-3">
          更新於 {new Date(d.fetchedAt).toLocaleString("zh-HK")}
        </p>
      ) : null}
    </>
  );
}
