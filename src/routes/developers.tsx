import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, PageHead, Pill } from "@/components/tx/ui";

export const Route = createFileRoute("/developers")({
  head: () => ({
    meta: [
      { title: "開發者 API · 天喜 TIANXI" },
      {
        name: "description",
        content: "天喜公開只讀 API（Bearer tx_live_…）：Elo、凍結預測、特徵。研究／非投注用途。",
      },
      { property: "og:title", content: "開發者 API · 天喜" },
      { property: "og:description", content: "認證只讀 API；未鎖今日預測不開放。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DevelopersPage,
});

const ENDPOINTS = [
  {
    method: "GET",
    path: "/api/v1/elo/horses/:id",
    query: "?from=&to=",
    desc: "馬匹 Elo 時間序列（天喜衍生）",
  },
  {
    method: "GET",
    path: "/api/v1/elo/snapshot",
    query: "?date=",
    desc: "指定日期 Elo 快照（可限 scopes）",
  },
  {
    method: "GET",
    path: "/api/v1/picks/frozen",
    query: "?date=",
    desc: "只回最終／已凍結四揀",
  },
  {
    method: "GET",
    path: "/api/v1/picks/history",
    query: "?from=&to=",
    desc: "凍結歷史＋命中摘要",
  },
  {
    method: "GET",
    path: "/api/v1/features/:raceId",
    query: "",
    desc: "只已排位／已鎖場次特徵（可選）",
  },
] as const;

function DevelopersPage() {
  return (
    <AppShell page="" columns={false} wide ticker="開發者 API · Bearer tx_live_… · 研究／非投注">
      <PageHead
        en="Developer API"
        title="公開只讀 API"
        desc="Pro 認證 · 天喜衍生數據 · 未鎖今日預測不開放"
      />

      <section className="mx-4 mt-3 rounded-md border border-gold/40 bg-paper-2 px-3 py-2 text-[12px] leading-relaxed text-ink-2">
        <strong className="text-ink">合規：</strong>
        必須 <code className="font-mono-tx text-[11px]">Authorization: Bearer tx_live_…</code>
        ；D1 只存 SHA-256。禁止無認證公開完整數據。內容僅供研究，唔構成投注建議。
      </section>

      <Card title="限額" en="Limits" action={<Pill tone="ink">建議預設</Pill>}>
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-ink-2">
          <li>每 key 每分鐘 {'<'} 60 次；超過回 429</li>
          <li>每 key 每日 {'<'} 5000 次；超過回 429</li>
          <li>Pro 會籍過期 → 403 entitlement_expired</li>
          <li>未凍結賽日嘅 picks／features → 403 not_frozen</li>
        </ul>
      </Card>

      <Card title="端點" en="Endpoints" action={<Pill tone="win">v1</Pill>}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-[11px]">
            <thead>
              <tr className="border-b border-hairline text-ink-3">
                <th className="py-1 pr-2 font-bold">方法</th>
                <th className="py-1 pr-2 font-bold">路徑</th>
                <th className="py-1 font-bold">說明</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="border-b border-hairline/60 align-top">
                  <td className="py-2 pr-2 font-mono-tx text-gold">{ep.method}</td>
                  <td className="py-2 pr-2 font-mono-tx text-[10px] text-ink">
                    {ep.path}
                    {ep.query ? <span className="text-ink-3">{ep.query}</span> : null}
                  </td>
                  <td className="py-2 text-ink-2">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="curl 範例" en="Example">
        <pre className="overflow-x-auto rounded-md bg-ink px-3 py-2 font-mono-tx text-[10px] leading-relaxed text-paper">
{`curl -sS 'https://api.tianxi.racing/api/v1/picks/frozen?date=2026-10-25' \\
  -H 'Authorization: Bearer tx_live_YOUR_KEY'`}
        </pre>
        <p className="mt-2 text-[11px] text-ink-3">
          Base URL 以實際 Worker 為準。金鑰喺{" "}
          <Link to="/account/api" className="text-gold">
            帳戶 → API
          </Link>{" "}
          建立（Pro；明文只顯示一次）。
        </p>
      </Card>

      <Card title="條款" en="Terms">
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-ink-2">
          <li>研究／非投注用途；唔提供落注或賠率套利服務。</li>
          <li>只開放天喜衍生數據；馬會原始資料不作再分發。</li>
          <li>研究層工具輸出唔入公開戰績；官方凍結四揀唔會經 API 被改寫。</li>
          <li>濫用、轉售或嘗試繞過限額／認證可撤銷 key。</li>
        </ul>
      </Card>

      <Disclaimer extra="API 文件頁 · 詳見帳戶 API 金鑰管理。" />
    </AppShell>
  );
}
