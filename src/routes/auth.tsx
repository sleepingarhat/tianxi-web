import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, PageHead } from "@/components/tx/ui";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/track";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signup" } => search["mode"] === "signup" ? { mode: "signup" } : {},
  head: () => ({
    meta: [
      { title: "帳戶登入 · 天喜 TIANXI" },
      { name: "description", content: "一般會員可免費註冊天喜，現階段限時免費使用香港賽馬功能；內部監控台只限管理員。" },
      { property: "og:title", content: "帳戶登入 · 天喜 TIANXI" },
      { property: "og:description", content: "免費建立一般會員帳戶，現階段限時免費使用天喜香港賽馬功能。內部監控台只限管理員。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function goAfterSignIn() {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    await router.navigate({ to: isAdmin ? "/admin" : "/membership" });
  }

  useEffect(() => {
    // 經驗證電郵連結或 Google 返嚟時，網址會帶 token／code；呢種入站要記做登入。
    const h = window.location.hash + window.location.search;
    const fromLink = /access_token=|code=|type=signup/.test(h);
    const viaGoogle = sessionStorage.getItem("tx_oauth_pending") === "google";
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) return;
      if (viaGoogle) {
        sessionStorage.removeItem("tx_oauth_pending");
        const u = data.session.user;
        const isNew = Date.now() - new Date(u.created_at).getTime() < 5 * 60_000;
        if (isNew) track("sign_up", { method: "google" });
        track("login", { method: "google" });
      } else if (fromLink) {
        track("login", { method: /type=signup/.test(h) ? "email_verify" : "email_link" });
      }
      void goAfterSignIn();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      if (mode === "signup") {
        track("sign_up_start", { method: "email" });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // 確認電郵一律跳返正式站：用 window.location.origin 會令喺預覽註冊嘅
          // 確認連結指去預覽網址（需登入 Lovable 先睇到，且版面會失效）。
          options: { emailRedirectTo: "https://tianxi.racing/auth" },
        });
        if (error) throw error;
        track("sign_up", { method: "email" });
        setMsg("已建立帳戶。如需電郵確認，請先檢查收件箱，然後回來登入。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("login", { method: "email" });
        await goAfterSignIn();
      }
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr(null);
    sessionStorage.setItem("tx_oauth_pending", "google");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth` },
    });
    if (error) setErr(error.message);
  }

  return (
    <AppShell ticker="一般會員免費註冊 · 現階段全站限時免費">
      <PageHead en={mode === "signup" ? "Create Account" : "Account Sign In"} title={mode === "signup" ? "免費註冊會員" : "會員登入"} desc="一般會員可免費建立帳戶，現階段限時免費使用天喜香港賽馬功能，毋須付款。" />

      <Card title={mode === "signin" ? "登入會員帳戶" : "建立免費會員帳戶"} en="Auth">
        <form onSubmit={submit} className="space-y-3">
          <label className="block text-[11px] text-ink-3">
            電郵
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-gold"
            />
          </label>
          <label className="block text-[11px] text-ink-3">
            密碼
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-gold"
            />
          </label>
          <Button
            type="submit"
            disabled={busy}
            className="w-full rounded-[8px] bg-deep px-3 py-2 font-serif-tc text-[13px] text-deep-fg disabled:opacity-50"
          >
            {busy ? "處理中…" : mode === "signin" ? "登入" : "免費建立帳戶"}
          </Button>
        </form>

        <Button
          variant="outline"
          type="button"
          onClick={google}
          className="mt-3 w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[13px] text-ink"
        >
          用 Google 繼續
        </Button>

        <Button
          variant="link"
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setErr(null);
            setMsg(null);
          }}
          className="mt-3 text-[11px] text-ink-3 underline"
        >
          {mode === "signin" ? "未有帳戶？免費註冊" : "已有帳戶？登入"}
        </Button>
        <p className="mt-3 text-[10px] text-ink-3">一般會員毋須管理員權限；內部監控台只限獲授權管理員，免費註冊不會取得管理員權限。</p>

        {err && <p className="mt-3 text-[12px] text-lose">{err}</p>}
        {msg && <p className="mt-3 text-[12px] text-win">{msg}</p>}
      </Card>
    </AppShell>
  );
}
