import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, PageHead } from "@/components/tx/ui";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Pro 會員登入 · 天喜 TIANXI" },
      { name: "description", content: "已購買天喜 Pro？用購買時同一個帳戶登入，系統會即時核實有效會籍。" },
      { property: "og:title", content: "Pro 會員登入 · 天喜 TIANXI" },
      { property: "og:description", content: "登入 Pro 會員中心，核實會籍。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <AppShell ticker="會員登入 · 核實有效會籍">
      <PageHead
        en="Pro Sign In"
        title="Pro 會員登入"
        desc="請用購買時同一個帳戶登入。付款完成頁、電郵或會員編號本身不會直接解鎖。"
      />

      <Card title="登入" en="Sign In">
        {sent ? (
          <p className="text-[12px] leading-relaxed text-ink-2">
            已收到 <b className="text-ink">{email}</b>。會籍核實系統仍在接入中，接通後會即時以此電郵驗證你的 Pro 權限。
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) setSent(true);
            }}
            className="space-y-2"
          >
            <label className="block text-[11px] font-bold text-ink-3" htmlFor="tx-email">
              購買時使用的電郵
            </label>
            <input
              id="tx-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-[6px] border border-hairline bg-paper px-2.5 py-2 text-[12px] text-ink outline-none focus:border-gold-strong"
            />
            <button
              type="submit"
              className="w-full rounded-[6px] border border-gold-strong/60 bg-gold-bg px-3 py-2 text-[12px] font-bold text-gold"
            >
              核實會籍
            </button>
          </form>
        )}
      </Card>

      <Card title="未有會籍？" en="Upgrade">
        <div className="flex gap-3 text-[12px] font-bold text-gold">
          <Link to="/membership">查看方案 →</Link>
          <Link to="/track-record">先睇公開戰績 →</Link>
        </div>
      </Card>

      <p className="text-center text-[11px] text-ink-3">
        登入即代表你同意
        <Link to="/terms" className="mx-1 text-gold underline">服務條款</Link>
        及
        <Link to="/privacy" className="mx-1 text-gold underline">私隱政策</Link>
        。
      </p>

      <Disclaimer />
    </AppShell>
  );
}
