import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AdminHead, NoteBox, Panel, StatusBadge } from "@/components/admin/kit";
import { REFRESH_KEY, useRacingHealth } from "@/components/admin/data";
import { txApi } from "@/lib/tx-api";
import { MembershipSettingsPanel } from "@/components/admin/MembershipSettingsPanel";
import { TelegramSettingsPanel } from "@/components/admin/TelegramSettingsPanel";
import {CryptoPassPanel} from '@/components/admin/CryptoPassPanel';

export const Route = createFileRoute("/_authenticated/admin/settings")({
  head: () => ({ meta: [{ title: "設定 · 天喜監控端" }, { name: "description", content: "設定 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:title", content: "設定 · 天喜監控端" }, { property: "og:description", content: "設定 · 天喜監控端：香港賽馬專用監控與唯讀對帳。" }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

const ENDPOINTS = [
  ["賽馬後端", txApi.base],
  ["引擎健康", "/api/public/engine-health"],
  ["賽馬鎖定狀態", "/api/public/lock-state"],
];

function usePing(u: string) {
  return useQuery({
    queryKey: ["admin", "ping", u],
    queryFn: async () => { const t = performance.now(); const r = await fetch(u.startsWith("http") ? `${u}/api/season` : u); return { ok: r.ok, code: r.status, ms: Math.round(performance.now() - t) }; },
    retry: 0, staleTime: 60_000,
  });
}
function EndpointRow({ n, u }: { n: string; u: string }) {
  const q = usePing(u);
  return (
    <li className="flex min-w-0 items-center gap-2 text-[12px]">
      <span className="w-28 shrink-0 text-ink-3">{n}</span>
      <span className="min-w-0 flex-1 truncate font-mono-tx text-[11px] text-ink-2" title={u}>{u}</span>
      <span className="tabnum shrink-0 font-mono-tx text-[10px] text-ink-3">{q.data ? `${q.data.code} · ${q.data.ms}ms` : q.isError ? "連唔到" : "…"}</span>
      <StatusBadge s={q.data ? (q.data.ok ? "ok" : "fail") : q.isError ? "fail" : "unknown"} />
    </li>
  );
}
function SettingsPage() {
  const rh = useRacingHealth();
  const [sec, setSec] = useState(60);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const v = Number(window.localStorage.getItem(REFRESH_KEY));
    if (Number.isFinite(v) && v >= 15) setSec(v);
  }, []);
  const save = () => {
    window.localStorage.setItem(REFRESH_KEY, String(Math.max(15, Math.min(3600, sec))));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  return (
    <>
      <AdminHead title="設定" en="Settings" desc="會員分級及監控端顯示設定。會員設定會套用全站；自動更新間隔只影響本機。" />
      <div className="grid gap-3 lg:grid-cols-2">
        <MembershipSettingsPanel />
        <TelegramSettingsPanel />
        <CryptoPassPanel settings />
        <Panel title="接口" en="API Endpoints">
          <ul className="space-y-1.5">
            {ENDPOINTS.map(([n, u]) => <EndpointRow key={String(n)} n={String(n)} u={String(u)} />)}
          </ul>
        </Panel>
        <Panel title="自動更新" en="Refresh Interval">
          <div className="flex items-center gap-2">
            <input type="number" min={15} max={3600} value={sec} onChange={(e) => setSec(Number(e.target.value))} className="w-24 rounded-[6px] border border-hairline bg-paper-3 px-2 py-1.5 font-mono-tx text-[12px] text-ink" />
            <span className="text-[12px] text-ink-3">秒（15–3600）</span>
            <button type="button" onClick={save} className="ml-auto rounded-[6px] bg-gold px-3 py-1.5 text-[12px] font-bold text-paper">{saved ? "已儲存" : "儲存"}</button>
          </div>
          <p className="mt-2 text-[10px] text-ink-3">重新載入頁面後生效。</p>
        </Panel>
        <Panel title="營運規則（唯讀）" en="Rules">
          <ul className="space-y-1 text-[12px] text-ink-2">
            <li>賽馬：首場前 90 分鐘凍結全日四揀＋第五選；每注 $10</li>
            <li>模型版本以 model_versions 登記，成績按版本獨立計</li>
          </ul>
        </Panel>
        <Panel title="主題" en="Theme">
          <p className="text-[12px] text-ink-2">TianXi x Linear 深色精密風（固定）。金色只用於重點、選中狀態同重要數字；綠／紅只表示成功／失敗。</p>
        </Panel>
        <Panel title="通知" en="Notifications" right={<StatusBadge s={rh.data?.telegram?.ok ? "ok" : rh.isLoading ? "unknown" : "fail"} />}>
          <p className="text-[12px] text-ink-2">{rh.data?.telegram?.detail ?? "檢查中…"}</p>
          <p className="mt-1 text-[11px] text-ink-3">{rh.data?.telegram?.chatLinked ? "已連接告警群組" : "未連接告警群組"} · 同一問題 12 小時內只報一次</p>
        </Panel>
      </div>
      <div className="mt-4"><NoteBox>市場賠率權重固定為 0；研究同生產分離。呢兩條原則唔可以喺監控端改。</NoteBox></div>
    </>
  );
}
