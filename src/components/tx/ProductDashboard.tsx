import { Link } from "@tanstack/react-router";
import { Activity, CalendarDays, ChevronDown, Database, ExternalLink, Network, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type Product = {
  key: string;
  eyebrow: string;
  title: string;
  summary: string;
  dashboard: { to: string; label: string };
  metrics: { label: string; value: string }[];
  flow: { title: string; detail: string; formula?: string }[];
  sources: { label: string; href: string }[];
  actions: { to: string; hash?: string; label: string }[];
  branches: { to: string; hash?: string; label: string; icon: LucideIcon }[];
};

const PRODUCTS: Product[] = [
  {
    key: "horse", eyebrow: "TX-ORACLE · HORSE RACING", title: "天喜賽馬",
    summary: "四揀排序、全日鎖定、官方名次對帳。主指標係四揀平均命中匹數。",
    dashboard: { to: "/dashboard", label: "進入天喜賽馬引擎" },
    metrics: [{ label: "主要輸出", value: "每場四揀" }, { label: "鎖定", value: "首場 T−90" }, { label: "盤口", value: "只作對照" }],
    flow: [
      { title: "賽前資料", detail: "排位、負磅、騎練、往績與 as-of 場地資料。", formula: "xᵢ(t) = f({r : date(r) < t})" },
      { title: "雙層排序", detail: "天喜ELO 後備線與 LightGBM LambdaRank 同場排序。", formula: "blendᵢ = αzᶫᵍᵇᵢ + (1−α)zᵉˡᵒᵢ" },
      { title: "機率與四揀", detail: "以 Harville／Plackett–Luce 派生獨贏及位置機率；排序取四揀。", formula: "P(winᵢ) = wᵢ / Σⱼwⱼ" },
      { title: "凍結對帳", detail: "首場前 90 分鐘一次鎖全日；賽後只接官方名次。", formula: "KPI = (1/R)Σ|TOP4ᵣ ∩ 實際首四ᵣ|" },
    ],
    sources: [{ label: "賽馬數據庫", href: "https://github.com/sleepingarhat/tianxi-racing" }, { label: "賽馬引擎", href: "https://github.com/sleepingarhat/tianxi-racing" }],
    actions: [{ to: "/strategy-pnl", label: "天喜策略累計盈虧" }, { to: "/prediction-vs-result", label: "預測與賽果" }],
    branches: [{ to: "/predictor", label: "選馬", icon: Activity }, { to: "/schedule", label: "日程", icon: CalendarDays }, { to: "/encyclopedia", label: "百科", icon: Database }, { to: "/engine", label: "引擎", icon: Network }],
  },

];

function ProductCard({ product, index }: { product: Product; index: number }) {
  return <article className="min-w-0 bg-paper">
    <div className="border-b border-hairline bg-paper px-3.5 py-3">
      <div className="flex items-start gap-3"><span className="tabnum grid h-10 w-10 shrink-0 place-items-center rounded-[6px] border border-gold-strong bg-deep font-mono-tx text-[14px] font-bold text-gold-strong shadow-sm">0{index + 1}</span><div className="min-w-0 flex-1"><p className="font-mono-tx text-[8px] font-bold uppercase tracking-[0.18em] text-ink-3">{product.eyebrow}</p><h2 className="fx-spotlight mt-0.5 font-serif-tc text-[19px] font-bold text-ink">{product.title}</h2></div></div>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-2">{product.summary}</p>
    </div>
    <div className="grid grid-cols-3 border-b border-hairline bg-paper-3/50">{product.metrics.map((m) => <div key={m.label} className="min-w-0 border-r border-hairline px-2 py-2 last:border-r-0"><p className="text-[8px] text-ink-3">{m.label}</p><p className="mt-0.5 truncate font-mono-tx text-[11px] font-bold text-ink">{m.value}</p></div>)}</div>
    <div className="space-y-2.5 p-3">
      <Button asChild className="h-11 w-full border border-gold bg-gradient-to-b from-gold-strong to-gold font-serif-tc text-[13px] font-bold text-ink shadow-md hover:from-gold hover:to-gold-strong"><Link to={product.dashboard.to}><span>{product.dashboard.label}</span><span aria-hidden className="text-[17px] leading-none">→</span></Link></Button>
      <details className="group overflow-hidden rounded-[6px] border border-hairline bg-paper"><summary className="flex cursor-pointer list-none items-center gap-2 px-2.5 py-2 text-[11px] font-bold text-ink marker:content-none"><Network className="h-4 w-4 text-gold" aria-hidden="true" />技術流程與公式<ChevronDown className="ml-auto h-4 w-4 text-ink-3 transition-transform group-open:rotate-180" aria-hidden="true" /></summary><ol className="border-t border-hairline px-2.5 py-1.5">{product.flow.map((s, i) => <li key={s.title} className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 border-b border-hairline py-2 last:border-b-0"><span className="tabnum grid h-[22px] w-[22px] place-items-center rounded-[4px] bg-gold-bg font-mono-tx text-[10px] font-bold text-gold">{i + 1}</span><div className="min-w-0"><h3 className="text-[11px] font-bold text-ink">{s.title}</h3><p className="mt-0.5 text-[11px] leading-relaxed text-ink-3">{s.detail}</p>{s.formula ? <code className="mt-1 block overflow-x-auto whitespace-nowrap rounded-[4px] bg-paper-3 px-1.5 py-1 font-mono-tx text-[10px] text-ink-2">{s.formula}</code> : null}</div></li>)}</ol></details>
      <div><p className="mb-1.5 font-mono-tx text-[8px] font-bold uppercase tracking-[0.16em] text-ink-3">公開 GitHub 來源</p><div className="flex flex-wrap gap-1.5">{product.sources.map((s) => <Button key={`${s.href}-${s.label}`} asChild variant="outline" size="sm" className="h-7 border-hairline bg-paper px-2 text-[11px] text-ink hover:border-gold-strong hover:bg-gold-bg"><a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}<ExternalLink aria-hidden="true" /></a></Button>)}</div></div>
      <div className="grid grid-cols-2 gap-1.5">{product.actions.map((a, i) => <Button key={a.label} asChild variant={i === 0 ? "default" : "outline"} className={i === 0 ? "h-auto min-h-10 whitespace-normal bg-gold px-2 py-2 text-center text-[11px] leading-tight text-ink hover:bg-gold/90" : "h-auto min-h-10 whitespace-normal border-gold-strong/50 bg-gold-bg px-2 py-2 text-center text-[11px] leading-tight text-ink hover:bg-gold-bg"}>{a.hash ? <Link to={a.to} hash={a.hash}>{a.label}</Link> : <Link to={a.to}>{a.label}</Link>}</Button>)}</div>
      <div className="grid grid-cols-4 gap-1 border-t border-hairline pt-2">{product.branches.map((b) => b.hash ? <Link key={b.label} to={b.to} hash={b.hash} className="grid min-w-0 justify-items-center gap-1 rounded-[5px] px-1 py-1.5 text-center text-[10px] font-bold text-ink-2 hover:bg-gold-bg hover:text-gold"><b.icon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" /><span className="truncate">{b.label}</span></Link> : <Link key={b.label} to={b.to} className="grid min-w-0 justify-items-center gap-1 rounded-[5px] px-1 py-1.5 text-center text-[10px] font-bold text-ink-2 hover:bg-gold-bg hover:text-gold"><b.icon className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" /><span className="truncate">{b.label}</span></Link>)}</div>
    </div>
  </article>;
}

export function ProductDashboard() {
  return <div className="px-4 py-4 md:px-5">{PRODUCTS.map((product, index) => <ProductCard key={product.key} product={product} index={index} />)}</div>;
}