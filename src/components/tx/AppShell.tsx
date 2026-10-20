import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/lib/useAuthState";
import tianxiLogo from "@/assets/tianxi-racing-logo-v10.jpg";
import { OverflowTicker } from "./OverflowTicker";



export type NavKey =
  | "dashboard"
  | "horse"
  | "predictor"
  | "schedule"
  | "encyclopedia"
  | "engine"
  | "";

const BOTNAV: { to: string; key: NavKey; label: string; icon: ReactNode }[] = [
  {
    to: "/",
    key: "dashboard",
    label: "首頁",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>
    ),
  },
  {
    to: "/predictor",
    key: "horse",
    label: "選馬",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </>
    ),
  },

  { to: "/schedule", key: "schedule", label: "賽程", icon: <><rect x="4" y="5" width="16" height="16" rx="2" /><path d="M8 3v4M16 3v4M4 11h16" /></> },
  { to: "/engine", key: "engine", label: "引擎", icon: <><circle cx="12" cy="12" r="9" /><path d="M12 12l5-5M5 16h14" /></> },
];



export function AppShell({
  page = "",
  ticker,
  wide = false,
  columns = true,
  children,
}: {
  page?: NavKey;
  ticker?: ReactNode;
  wide?: boolean;
  /** 電腦版卡片兩欄；有自家版面嘅頁設 false */
  columns?: boolean;
  children: ReactNode;
}) {
  const { signedIn, isAdmin } = useAuthState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await supabase.auth.signOut();
      navigate({ to: "/", replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper-3 font-sans-tc text-ink">
      <div className={`relative mx-auto flex min-h-screen w-full flex-col border-x border-hairline bg-paper ${wide ? "max-w-[1040px] xl:max-w-[1200px]" : "max-w-[440px] md:max-w-[880px] lg:max-w-[1040px] xl:max-w-[1200px]"}`}>
        <header className="sticky top-0 z-20 grid min-h-[56px] grid-cols-[auto_1fr_auto] items-center gap-2.5 border-b border-tan/10 bg-deep px-4 py-2.5 text-deep-fg">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <img src={tianxiLogo} width="40" height="40" alt="" className="h-10 w-10 shrink-0 rounded-[7px] object-cover" />
            <span className="flex flex-col leading-none max-[380px]:hidden">
              <span className="fx-spotlight fx-spotlight-brand font-serif-tc text-[16px] font-bold tracking-[0.01em]">天喜 TIANXI</span>
              <small className="fx-foil mt-[3px] block text-[9px] font-semibold uppercase tracking-[0.24em] text-tan">
                Hong Kong Racing
              </small>
            </span>
          </Link>
          <div />
          <div className="flex items-center gap-3">
            {isAdmin ? (
              <Link
                to="/admin"
                aria-label="內部監控台"
                className="grid h-8 w-8 place-items-center rounded-[8px] border border-tan/25 text-deep-fg transition-colors hover:border-gold-strong"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3.2" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-2.9-1.2l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 3 15H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6h.09A1.7 1.7 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 2.9 1.2l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 21 11a2 2 0 1 1 0 4z" />
                </svg>
              </Link>
            ) : null}
            <Link
              to="/track-record"
              className="self-center whitespace-nowrap font-serif-tc text-[12px] font-bold text-tan hover:text-gold-strong"
            >
              戰績
            </Link>
            {signedIn ? (
              <>
                <Link
                  to="/membership"
                  className="self-center whitespace-nowrap font-serif-tc text-[12px] font-bold text-tan hover:text-gold-strong"
                >
                  會員
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  disabled={signingOut}
                  className="whitespace-nowrap rounded-full border border-tan/30 px-3.5 py-[7px] font-serif-tc text-[12px] font-bold tracking-[0.03em] text-deep-fg transition-transform active:scale-95 disabled:opacity-60 max-[380px]:px-2.5"
                >
                  {signingOut ? "登出中…" : "登出"}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  className="self-center whitespace-nowrap font-serif-tc text-[12px] font-bold text-tan hover:text-gold-strong"
                >
                  登入
                </Link>
                <Link
                  to="/membership"
                  aria-label="升級 Pro"
                  className="whitespace-nowrap rounded-full border border-gold bg-gradient-to-b from-gold-strong to-gold px-3.5 py-[7px] font-serif-tc text-[12px] font-bold tracking-[0.03em] text-[#3a2a08] shadow-[0_1px_2px_rgba(0,0,0,0.2)] transition-transform active:scale-95 max-[380px]:px-2.5"
                >
                  <span className="max-[380px]:hidden">升級 Pro</span>
                  <svg
                    viewBox="0 0 24 24"
                    className="hidden h-4 w-4 max-[380px]:block"
                    fill="currentColor"
                    stroke="none"
                    aria-hidden="true"
                  >
                    <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9L12 2.5z" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </header>

        {ticker ? (
          <div className="border-b border-gold-strong/30 bg-gold-bg px-4 py-1.5">
            <p className="tabnum grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 font-mono-tx text-[10px] font-bold leading-none text-gold">
              <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
              <OverflowTicker>{ticker}</OverflowTicker>
            </p>
          </div>
        ) : null}

        <main className={`${columns ? "tx-main " : ""}flex-1 pb-28`}>{children}</main>

        <nav className={`fixed bottom-0 left-1/2 z-40 grid w-full -translate-x-1/2 auto-cols-fr grid-flow-col gap-0.5 border-t border-tan/10 bg-deep px-1 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2 ${wide ? "max-w-[1040px] xl:max-w-[1200px]" : "max-w-[440px] md:max-w-[880px] lg:max-w-[1040px] xl:max-w-[1200px]"}`}>
          {BOTNAV.map((item) => {
            const on = item.key === page || (item.key === "horse" && ["horse", "predictor", "encyclopedia"].includes(page));
            return (
              <Link
                key={item.key}
                to={item.to}
                className="grid justify-items-center gap-[3px] px-0.5 py-1.5 transition-transform active:scale-95"
                aria-current={on ? "page" : undefined}
              >
                <svg
                  viewBox="0 0 24 24"
                  className={`h-[22px] w-[22px] ${on ? "text-gold-strong" : "text-deep-fg/55"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {item.icon}
                </svg>
                <span
                  className={`text-[10px] tracking-[0.06em] ${
                    on ? "font-bold text-gold-strong" : "font-medium text-deep-fg/65"
                  }`}
                >
                  {item.label}
                </span>
                <span
                  className={`h-0.5 w-5 rounded-full ${on ? "bg-gold-strong" : "bg-transparent"}`}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
