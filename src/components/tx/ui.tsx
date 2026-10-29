import type { ButtonHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { silksCodeOf, silksGifUrl, silksHdUrl } from "@/lib/tx-api";
import { cn } from "@/lib/utils";

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
      {desc ? <p className="mt-2 max-w-[62ch] text-[13px] leading-relaxed text-ink-2">{desc}</p> : null}
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
    <section className={`tx-card mx-4 my-3 min-w-0 overflow-hidden rounded-[8px] border border-hairline bg-paper-2 shadow-sm ${className}`}>
      {title ? (
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-hairline bg-paper/50 px-3 py-2.5">
          <h2 className="min-w-0 font-serif-tc text-[15px] font-bold leading-relaxed text-ink">
            {title}
            {en ? (
              <small className="mt-0.5 block font-mono-tx text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
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
      className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-[3px] text-[11px] font-bold leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-hairline bg-paper px-2.5 py-2 transition hover:-translate-y-px hover:border-gold-strong/40">
      <p className="text-[11px] font-medium leading-tight text-ink-3">{label}</p>
      <p className="tabnum mt-1.5 font-mono-tx text-[18px] font-bold leading-none text-ink">{value}</p>
      {sub ? <p className="tabnum mt-1 font-mono-tx text-[10px] leading-tight text-ink-3">{sub}</p> : null}
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
        <div key={i} className="flex items-center gap-3 rounded-[10px] border border-hairline p-3">
          <div className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-paper-3" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-paper-3" />
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-paper-3" />
          </div>
          <div className="h-5 w-10 animate-pulse rounded bg-paper-3" />
        </div>
      ))}
    </div>
  );
}



/** 天喜公開 CTA：Gold / Deep / Outline（紙墨金語言） */
const txCtaVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-bold transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50 disabled:pointer-events-none disabled:opacity-50 active:scale-95 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        gold:
          "rounded-full border border-gold bg-gradient-to-b from-gold-strong to-gold text-gold-ink shadow-[0_1px_2px_color-mix(in_oklab,var(--tx-ink)_20%,transparent)] hover:brightness-[1.03]",
        deep:
          "rounded-full border border-deep bg-deep text-deep-fg shadow-sm hover:bg-deep/90",
        outline:
          "rounded-full border border-hairline bg-paper text-ink shadow-sm hover:bg-paper-2",
      },
      size: {
        sm: "h-8 px-3.5 font-serif-tc text-[12px] tracking-[0.03em]",
        md: "h-10 px-5 text-[13px]",
        lg: "h-12 px-6 text-[14px]",
      },
    },
    defaultVariants: {
      variant: "deep",
      size: "md",
    },
  },
);

export interface TxCtaProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof txCtaVariants> {
  asChild?: boolean;
}

/** Brand CTA button. Prefer this over shadcn Button for public Gold/Deep/Outline actions. */
export const TxCta = forwardRef<HTMLButtonElement, TxCtaProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(txCtaVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
TxCta.displayName = "TxCta";

export function ErrorNote({ error }: { error: unknown }) {
  return (
    <p className="rounded-[8px] border border-lose/30 bg-lose/5 px-3 py-2 text-[12px] leading-relaxed text-lose">
      資料載入失敗：{error instanceof Error ? error.message : "未知錯誤"}
    </p>
  );
}

export function Empty({ label = "暫無資料" }: { label?: string }) {
  return <p className="py-5 text-center text-[12px] text-ink-3">{label}</p>;
}

export function Scroller({ children }: { children: ReactNode }) {
  return <div className="no-scrollbar -mx-3 overflow-x-auto px-3">{children}</div>;
}

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-[12px] [&_tbody_tr]:border-b [&_tbody_tr]:border-hairline/60 [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-paper/60">
      <thead>
        <tr className="border-b border-hairline">
          {head.map((h, i) => (
            <th
              key={i}
              className={`whitespace-nowrap px-1.5 py-2 font-mono-tx text-[10px] font-bold uppercase tracking-wider text-ink-3 ${
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
            className={`whitespace-nowrap min-h-8 rounded-full border px-3 py-1.5 text-[12px] font-bold transition-all ${
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
