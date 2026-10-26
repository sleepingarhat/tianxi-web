import type { ReactNode } from "react";

import { silksCodeOf, silksGifUrl, silksHdUrl } from "@/lib/tx-api";

import { LemniLoader } from "./LemniLoader";

/** 馬會官方高清綵衣，失敗自動退回後端 GIF */
export function Silks({
  source,
  size = 24,
  className = "",
}: {
  source: { silksCode?: string | null; code?: string | null; horseId?: string | null; id?: string | null };
  size?: number;
  className?: string;
}) {
  const code = silksCodeOf(source);
  if (!code) return null;
  return (
    <img
      src={silksHdUrl(code)}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        const el = e.currentTarget;
        const gif = silksGifUrl(code);
        if (el.dataset["fallback"] !== "1" && gif) {
          el.dataset["fallback"] = "1";
          el.src = gif;
        } else {
          el.style.visibility = "hidden";
        }
      }}
      className={`shrink-0 rounded-[3px] border border-hairline bg-paper object-contain ${className}`}
    />
  );
}



export function PageHead({ en, title, desc }: { en: string; title: string; desc?: ReactNode }) {
  return (
    <section className="relative overflow-hidden border-b border-hairline bg-gradient-to-b from-paper-2 to-paper px-4 pb-4 pt-5">
      <span aria-hidden className="absolute left-4 top-0 h-[3px] w-10 rounded-b bg-gold" />
      <p className="font-mono-tx text-[10px] font-bold uppercase tracking-[0.28em] text-ink-3">{en}</p>
      <h1 className="fx-spotlight mt-1 font-serif-tc text-2xl font-bold leading-tight text-ink">{title}</h1>
      {desc ? <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{desc}</p> : null}
    </section>
  );
}

export function Card({
  title,
  en,
  action,
  children,
  className = "",
}: {
  title?: string;
  en?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`tx-card mx-4 my-3 overflow-hidden rounded-[8px] border border-hairline bg-paper-2 shadow-sm transition-shadow hover:shadow-md ${className}`}>
      {title ? (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline bg-paper/50 px-3 py-3">
          <h2 className="min-w-0 font-serif-tc text-[15px] font-bold leading-relaxed text-ink">
            {title}
            {en ? (
              <small className="mt-1 block font-mono-tx text-[9px] font-bold uppercase text-ink-3">
                {en}
              </small>
            ) : null}
          </h2>
          {action ? <div className="shrink-0 whitespace-nowrap">{action}</div> : null}
        </header>
      ) : null}
      <div className="px-3 py-3">{children}</div>
    </section>
  );
}

export function Pill({
  children,
  tone = "ink",
}: {
  children: ReactNode;
  tone?: "ink" | "gold" | "win" | "lose" | "deep";
}) {
  const tones: Record<string, string> = {
    ink: "border-hairline bg-paper text-ink-2",
    gold: "border-gold-strong/40 bg-gold-bg text-gold",
    win: "border-win/30 bg-win/10 text-win",
    lose: "border-lose/30 bg-lose/10 text-lose",
    deep: "border-deep bg-deep text-deep-fg",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[2px] text-[10px] font-bold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-hairline bg-paper px-2.5 py-2 transition hover:-translate-y-px hover:border-gold-strong/40">
      <p className="text-[10px] font-medium leading-none text-ink-3">{label}</p>
      <p className="tabnum mt-1.5 font-mono-tx text-[17px] font-bold leading-none text-ink">{value}</p>
      {sub ? <p className="tabnum mt-1 font-mono-tx text-[9px] leading-none text-ink-3">{sub}</p> : null}
    </div>
  );
}

export function StatGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = { 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" }[cols];
  return <div className={`grid gap-2 ${c}`}>{children}</div>;
}

export function Loading({
  label = "載入中…",
  size = "md",
}: {
  label?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="animate-fade-in space-y-3" aria-busy="true">
      <LemniLoader label={label} size={size} />
      {size !== "sm" && <SkeletonRows />}
    </div>
  );
}

export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-[10px] border border-border/60 p-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
          </div>
          <div className="h-5 w-10 animate-pulse rounded bg-muted" />
        </div>
      ))}
    </div>
  );
}


export function ErrorNote({ error }: { error: unknown }) {
  return (
    <p className="rounded-[8px] border border-lose/30 bg-lose/5 px-3 py-2 text-[11px] leading-relaxed text-lose">
      資料載入失敗：{error instanceof Error ? error.message : "未知錯誤"}
    </p>
  );
}

export function Empty({ label = "暫無資料" }: { label?: string }) {
  return <p className="py-5 text-center text-[11px] text-ink-3">{label}</p>;
}

export function Scroller({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-3 overflow-x-auto px-3">{children}</div>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[11px]">
      <thead>
        <tr className="border-b border-hairline">
          {head.map((h, i) => (
            <th
              key={i}
              className={`whitespace-nowrap px-1.5 py-1.5 font-mono-tx text-[9px] font-bold uppercase tracking-wider text-ink-3 ${
                i === 0 ? "text-left" : "text-right"
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

export function Td({
  children,
  first,
  mono = true,
  className = "",
}: {
  children: ReactNode;
  first?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`whitespace-nowrap px-1.5 py-1.5 ${first ? "text-left" : "text-right"} ${
        mono && !first ? "tabnum font-mono-tx" : ""
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-bold transition-all ${
              on
                ? "border-gold-strong bg-gold-bg text-gold"
                : "border-hairline bg-paper text-ink-2 hover:border-gold-strong/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Disclaimer({ extra }: { extra?: ReactNode }) {
  return (
    <footer className="mt-4 border-t border-hairline px-4 py-5 text-[10px] leading-relaxed text-ink-3">
      <strong className="text-ink-2">天喜為分析平台，不提供投注服務。</strong>
      <br />
      投注請透過合法渠道（HKJC）進行。
      {" · "}
      <a href="/developers" className="text-ink-3 underline decoration-hairline hover:text-gold">開發者 API</a>
      {extra ? <div className="mt-1">{extra}</div> : null}
    </footer>
  );
}
