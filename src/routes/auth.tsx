import { lovable } from "@/integrations/lovable";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, PageHead } from "@/components/tx/ui";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/track";
import { Button } from "@/components/ui/button";
import { HORSE_ID } from "@/lib/watchlist";
import { passwordStrength } from "@/lib/password-strength";
import { safeAuthNext } from "@/lib/auth-next";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { mode?: "signup"; next?: string; follow?: string } => {
    const next = safeAuthNext(search["next"]);
    return { ...(search["mode"] === "signup" ? { mode: "signup" as const } : {}), ...(next ? { next } : {}), ...(typeof search["follow"] === "string" && HORSE_ID.test(search["follow"]) ? {follow:search["follow"]} : {}) };
  },
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

/** 將 Google 授權錯誤譯做會員睇得明嘅提示，附點樣繼續。 */
function describeGoogleError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("access_denied") || s.includes("popup_closed") || s.includes("popup closed") || s.includes("cancel")) {
    return "你已取消 Google 授權，今次未有登入。想繼續嘅話，請再撳一次「用 Google 繼續」。";
  }
  if (s.includes("network") || s.includes("fetch") || s.includes("timeout")) {
    return "網絡連線唔穩定，未能接通 Google。請檢查網絡後再試一次。";
  }
  if (s.includes("unsupported provider") || s.includes("provider")) {
    return "Google 登入服務暫時未能使用，請稍後再試，或改用電郵登入。";
  }
  return `Google 登入未能完成（${raw}）。請再試一次；若持續失敗，可改用電郵登入。`;
}

/** 將常見登入／註冊英文錯誤譯成中文。 */
function describeAuthError(raw: string): string {
  const s = raw.toLowerCase();
  if (s.includes("weak") || s.includes("easy to guess") || s.includes("pwned")) return "呢個密碼太常見、容易被估中，請改用另一個較強嘅密碼（8 個字元或以上，混合大小寫英文、數字及符號）。";
  if (s.includes("at least") && s.includes("character")) return "密碼太短，請至少輸入 8 個字元。";
  if (s.includes("invalid login") || s.includes("invalid credentials")) return "電郵或密碼唔啱，請再試一次。";
  if (s.includes("email not confirmed")) return "電郵未確認，請先到收件箱（包括垃圾郵件）撳確認連結。";
  if (s.includes("already registered") || s.includes("already exists")) return "呢個電郵已經註冊，請直接登入。";
  if (s.includes("rate limit") || s.includes("too many")) return "嘗試次數太多，請稍候再試。";
  if (s.includes("invalid") && s.includes("email")) return "電郵格式唔正確。";
  return `操作未能完成（${raw}），請再試一次。`;
}

function PasswordMeter({ pw }: { pw: string }) {
  if (!pw) return null;
  const { score, label, checks, common } = passwordStrength(pw);
  const tone = score <= 1 ? "bg-lose" : score <= 2 ? "bg-gold" : "bg-win";
  const text = score <= 1 ? "text-lose" : score <= 2 ? "text-gold" : "text-win";
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? tone : "bg-hairline"}`} />
        ))}
      </div>
      <p className={`mt-1 text-[11px] font-bold ${text}`}>密碼強度：{label}{common ? "（屬常見密碼，容易被估中）" : ""}</p>
      <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? "text-win" : "text-ink-3"}>{c.ok ? "✓" : "○"} {c.label}</li>
        ))}
      </ul>
    </div>
  );
}

function AuthPage() {
  const router = useRouter();
  const search = Route.useSearch();
  const [mode, setMode] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function goAfterSignIn() {
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id;
    if (!userId) return;
    const next = safeAuthNext(search.next ?? sessionStorage.getItem("tx_auth_next"));
    sessionStorage.removeItem("tx_auth_next");
    if (next) { window.location.assign(next); return; }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    await router.navigate({ to: isAdmin ? "/admin" : "/membership" });
  }

  useEffect(() => {
    // 經驗證電郵連結或 Google 返嚟時，網址會帶 token／code；呢種入站要記做登入。
    const h = window.location.hash + window.location.search;
    const fromLink = /access_token=|code=|type=signup/.test(h);
    const viaGoogle = sessionStorage.getItem("tx_oauth_pending") === "google";

    // Google 授權被拒／出錯時，回跳網址會帶 error 參數；讀完即清走，避免刷新後重複顯示。
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthError = params.get("error") ?? hashParams.get("error");
    const oauthErrorDesc = params.get("error_description") ?? hashParams.get("error_description");
    if (oauthError) {
      sessionStorage.removeItem("tx_oauth_pending");
      setErr(describeGoogleError(oauthErrorDesc ?? oauthError));
      window.history.replaceState(null, "", window.location.pathname);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        // 上次撳過 Google 但冇 session 返嚟：多數係中途關咗授權視窗，提示會員可以重試。
        if (viaGoogle) {
          sessionStorage.removeItem("tx_oauth_pending");
          setMsg("上次 Google 登入未完成（可能關閉咗授權畫面）。想繼續嘅話，請再撳一次「用 Google 繼續」。");
        }
        return;
      }
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
        setMsg("已建立帳戶。確認電郵已寄出，請檢查收件箱；如未見到，請睇埋「垃圾郵件」並標記為「非垃圾郵件」。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        track("login", { method: "email" });
        await goAfterSignIn();
      }
    } catch (e2) {
      setErr(describeAuthError(e2 instanceof Error ? e2.message : String(e2)));
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setErr(null);
    setMsg(null);
    setGoogleBusy(true);
    sessionStorage.setItem("tx_oauth_pending", "google");
    if (search.next) sessionStorage.setItem("tx_auth_next", search.next);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth`,
      });
      if (result.error) {
        sessionStorage.removeItem("tx_oauth_pending");
        setErr(describeGoogleError(result.error instanceof Error ? result.error.message : String(result.error)));
        return;
      }
      if (result.redirected) return; // 整頁跳轉去 Google，返嚟時由 useEffect 接手
      track("login", { method: "google" });
      await goAfterSignIn();
    } catch (e2) {
      sessionStorage.removeItem("tx_oauth_pending");
      setErr(describeGoogleError(e2 instanceof Error ? e2.message : String(e2)));
    } finally {
      setGoogleBusy(false);
    }
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
              minLength={mode === "signup" ? 8 : 6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[13px] text-ink outline-none focus:border-gold"
            />
            {mode === "signup" && <PasswordMeter pw={password} />}
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
          disabled={googleBusy || busy}
          className="mt-3 w-full rounded-[8px] border border-hairline bg-paper-2 px-3 py-2 text-[13px] text-ink disabled:opacity-50"
        >
          {googleBusy ? "正在連接 Google…請稍候" : "用 Google 繼續"}
        </Button>
        {googleBusy && (
          <p className="mt-2 text-[11px] text-ink-3">
            即將跳轉去 Google 授權畫面；完成授權後會自動帶你返嚟天喜。
          </p>
        )}

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
