import { Link } from "@tanstack/react-router";
import { MoatSection } from "./MoatSection";
import { WeeklyRacecoursePosters } from "./RacecoursePhoto";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { FoundingMemberOffer } from "./FoundingMemberOffer";
import { TxCta } from "./ui";

/** 首頁：分段講解天喜賽馬預測引擎（參考「一段一功能 + 手機示意 + 編號標註」版式）。示意畫面唔係真實預測。 */

function Phone({ title, children, tag }: { title: string; children: ReactNode; tag?: string }) {
  return (
    <div className="relative mx-auto w-[220px] shrink-0 rounded-[28px] border border-hairline bg-ink p-[6px] shadow-xl">
      <div className="overflow-hidden rounded-[22px] bg-paper">
        <div className="flex items-center justify-between px-3 pt-2 text-[8px] font-bold text-ink-2"><span className="tabnum">9:41</span><span className="h-3 w-14 rounded-full bg-ink" /><span>●●●</span></div>
        <p className="px-3 pb-1.5 pt-2 font-serif-tc text-[12px] font-bold text-ink">{title}</p>
        <div className="space-y-1.5 px-3 pb-3">{children}</div>
      </div>
      {tag ? <span className="absolute -right-2 -top-2 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold text-ink shadow">{tag}</span> : null}
    </div>
  );
}

const Row = ({ n, name, v, hl }: { n: string; name: string; v: string; hl?: boolean }) => (
  <div className={`flex items-center gap-2 rounded-[6px] border px-2 py-1.5 text-[10px] ${hl ? "border-gold-strong/60 bg-gold-bg" : "border-hairline bg-paper-2"}`}>
    <span className="tabnum grid h-5 w-5 place-items-center rounded-[4px] bg-deep font-mono-tx text-[9px] font-bold text-gold-strong">{n}</span>
    <span className="flex-1 truncate text-ink">{name}</span>
    <span className="tabnum font-mono-tx text-ink-2">{v}</span>
  </div>
);

const Note = ({ i, children }: { i: number; children: ReactNode }) => (
  <li className="flex gap-2 text-[12px] leading-relaxed text-ink-2">
    <span className="tabnum mt-[2px] grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-gold font-mono-tx text-[10px] font-bold text-ink">{i}</span>
    <span>{children}</span>
  </li>
);

type Section = { no: string; tag: string; title: ReactNode; desc: string; notes: ReactNode[]; formula?: string; phone: ReactNode; link?: { to: "/predictor" | "/strategy-pnl" | "/prediction-vs-result" | "/engine" | "/schedule"; label: string } };

const SECTIONS: Section[] = [
  {
    no: "01", tag: "賽前資料", title: <>只用開跑前<br />已知嘅資料</>,
    desc: "排位、負磅、檔位、騎練、往績、試閘、血統同途程地況，全部按 as-of 截取：每一個特徵只計該場之前嘅紀錄，杜絕「用未來資料估過去」。",
    formula: "xᵢ(t) = f({ r : date(r) < t })",
    notes: ["途程、場地、地況嘅成績按賽前時點計，唔偷睇賽果", "天氣快照逐場記錄，入研究閘先可用", "臨場盤口唔入模型，只喺選馬頁作對照"],
    phone: <Phone title="特徵快照 · 示意"><Row n="檔" name="檔位 / 負磅" v="as-of" /><Row n="騎" name="騎師 · 練馬師" v="近 90 日" /><Row n="程" name="同程同地況" v="賽前" /><Row n="閘" name="試閘 · 血統" v="賽前" /><Row n="天" name="天氣快照" v="研究閘" /></Phone>,
  },
  {
    no: "02", tag: "雙層排序", title: <>天喜 ELO 打底，<br />LightGBM 排先後</>,
    desc: "每匹馬先有天喜 ELO 實力分作後備線，再由 LightGBM LambdaRank 學同場排序，兩邊標準化後按固定比例混合。比例已凍結，唔會為追成績臨場改。",
    formula: "blendᵢ = α·zᴸᴳᴮᵢ + (1−α)·zᴱᴸᴼᵢ　α = 0.88",
    notes: ["版本指紋記錄於模型版本表，成績按版本分開計", "升唔升級由研究閘報告、用戶拍板"],
    phone: <Phone title="同場排序 · 示意" tag="α 0.88"><Row n="1" name="LGB 排序分" v="z = 1.42" hl /><Row n="2" name="ELO 實力分" v="z = 0.87" /><Row n="=" name="混合分" v="1.35" hl /><div className="h-14 rounded-[6px] bg-gradient-to-t from-gold-bg to-paper-2" /></Phone>,
  },
  {
    no: "03", tag: "四揀＋第五選", title: <>由排序變機率，<br />揀出每場四匹</>,
    desc: "以 Harville／Plackett–Luce 由排序分派生獨贏同位置機率，取頭四做「四揀」，第五名做第五選，供孖T／三T 拖腳用。",
    formula: "P(winᵢ) = wᵢ / Σⱼ wⱼ",
    notes: ["主指標係四揀平均命中匹數（目標 3／4）", "唔標榜首選或頭馬命中率", "選馬頁左「模型搏冷」、右「市場穩陣」只作對照"],
    phone: <Phone title="第 1 場 · 四揀示意"><Row n="1" name="首選" v="24%" hl /><Row n="2" name="次選" v="18%" hl /><Row n="3" name="第三選" v="13%" /><Row n="4" name="第四選" v="11%" /><Row n="5" name="第五選（拖腳）" v="8%" /></Phone>,
    link: { to: "/predictor", label: "睇今日四揀" },
  },
  {
    no: "04", tag: "賽前凍結", title: <>首場前 90 分鐘<br />全日一次鎖定</>,
    desc: "全日四揀同第五選喺首場開跑前 90 分鐘凍結寫入只增不改嘅紀錄。賽後只會補官方名次同派彩重算對帳，凍結預測一個字都唔改。",
    notes: ["停賽、改期由引擎自動偵測", "賽果延遲會自動補跑，只追補對帳", "凍結時間同版本可逐場追溯"],
    phone: <Phone title="鎖定狀態 · 示意" tag="T−90"><div className="rounded-[6px] border border-gold-strong/60 bg-gold-bg p-2 text-center"><p className="text-[9px] text-ink-3">全日四揀</p><p className="font-serif-tc text-[14px] font-bold text-gold">已凍結 🔒</p></div><Row n="✓" name="四揀 + 第五選" v="已寫入" /><Row n="✓" name="版本指紋" v="tx-oracle-v3" /><Row n="…" name="官方賽果" v="完場後" /></Phone>,
    link: { to: "/schedule", label: "睇賽程" },
  },
  {
    no: "05", tag: "對帳盈虧", title: <>六個彩池逐場計，<br />蝕都照列</>,
    desc: "每場以 $10／注假設：四連環、單T、三重彩、四重彩用四揀複式；孖T、三T 用頭兩匹做膽拖第 3–5 選。成本、派彩、淨盈虧逐日累計，派彩以馬會官方紀錄為準。",
    notes: ["可揀賽馬日睇每場每個彩池中唔中", "孖T／三T 正獎、安慰獎分開列", "負數照實展示，唔會收埋"],
    phone: <Phone title="策略盈虧 · 示意"><div className="grid grid-cols-2 gap-1.5">{[["四連環", "✓"], ["單T", "✗"], ["三重彩", "✓"], ["四重彩", "✗"], ["孖T", "✓"], ["三T", "✗"]].map(([a, b]) => <div key={a} className={`rounded-[6px] border px-2 py-1.5 text-[10px] ${b === "✓" ? "border-win/40 text-win" : "border-hairline text-ink-3"}`}>{a} {b}</div>)}</div></Phone>,
    link: { to: "/strategy-pnl", label: "睇策略盈虧" },
  },
  {
    no: "06", tag: "健康與回測", title: <>每日自我體檢，<br />同隨機揀比過</>,
    desc: "引擎健康頁監察收料、鎖定同對帳排程；回測頁將四揀命中匹數同隨機揀馬基準比較，要明顯高過隨機先叫有用。",
    notes: ["失敗任務會自動重試同發警示", "研究閘只出報告，唔會自動升版"],
    phone: <Phone title="引擎健康 · 示意"><Row n="✓" name="收料排程" v="正常" /><Row n="✓" name="凍結任務" v="正常" /><Row n="✓" name="賽果對帳" v="正常" /><div className="h-12 rounded-[6px] bg-gradient-to-r from-paper-2 via-gold-bg to-paper-2" /></Phone>,
    link: { to: "/engine", label: "睇引擎" },
  },
];

export function EngineLanding() {
  return (
    <div className="overflow-hidden">
      <FoundingMemberOffer />
      <section className="relative px-5 pb-10 pt-8 md:px-10 md:pt-14">
        <div className="relative grid items-center gap-8 md:grid-cols-[1.1fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-strong/50 bg-gold-bg px-2.5 py-1 text-[11px] font-bold text-gold">● 全站免費中 · TX-Oracle 香港賽馬引擎</span>
            <h1 className="mt-4 font-serif-tc text-[34px] font-bold leading-[1.15] text-ink md:text-[48px]">
              賽前凍結四揀，<br /><span className="text-gold">賽後逐場對帳。</span>
            </h1>
            <p className="mt-3 max-w-md text-[14px] leading-relaxed text-ink-2">天喜專注沙田、跑馬地。由賽前資料到凍結預測、官方派彩對帳同六彩池盈虧，每一步都公開俾你核對。</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <TxCta asChild variant="gold"><Link to="/predictor">睇今日四揀 →</Link></TxCta>
              <TxCta asChild variant="outline"><Link to="/strategy-pnl">策略盈虧紀錄</Link></TxCta>
            </div>
            <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-3">
              {["限時免費 · Pro 全站功能", "凍結預測唔改", "負數照實列"].map((t) => <li key={t} className="flex items-center gap-1"><Check className="h-3.5 w-3.5 text-win" aria-hidden />{t}</li>)}
            </ul>
          </div>
          <div className="flex justify-center gap-4">
            {SECTIONS[3]?.phone}
          </div>
        </div>
      </section>
      <WeeklyRacecoursePosters />
      <MoatSection />


      {SECTIONS.map((s, i) => (
        <section key={s.no} className={`border-t border-hairline px-5 py-10 md:px-10 md:py-14 ${i % 2 ? "bg-paper-2/60" : ""}`}>
          <div className={`grid items-center gap-8 md:grid-cols-2 ${i % 2 ? "md:[&>*:first-child]:order-2" : ""}`}>
            <div>
              <p className="font-mono-tx text-[11px] font-bold text-gold">{s.no} · {s.tag}</p>
              <h2 className="mt-2 font-serif-tc text-[26px] font-bold leading-tight text-ink md:text-[34px]">{s.title}</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-ink-2">{s.desc}</p>
              {s.formula ? <code className="mt-3 block overflow-x-auto whitespace-nowrap rounded-[6px] bg-paper-3 px-2.5 py-1.5 font-mono-tx text-[11px] text-ink-2">{s.formula}</code> : null}
              <ul className="mt-4 space-y-1.5">{s.notes.map((n, k) => <Note key={k} i={k + 1}>{n}</Note>)}</ul>
              {s.link ? <Link to={s.link.to} className="mt-4 inline-block text-[12px] font-bold text-gold underline underline-offset-4">{s.link.label} →</Link> : null}
            </div>
            <div className="flex justify-center">{s.phone}</div>
          </div>
        </section>
      ))}
      <section className="border-t border-hairline px-5 py-8 md:px-10">
        <p className="font-mono-tx text-[9px] font-bold uppercase tracking-[0.18em] text-ink-3">QUICK ACCESS · 快速入口</p>
        <h2 className="mt-1 font-serif-tc text-[18px] font-bold text-ink">天喜賽馬功能一覽</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {[
            { to: "/dashboard", label: "賽馬引擎總覽" },
            { to: "/predictor", label: "今日選馬" },
            { to: "/prediction-vs-result", label: "預測與賽果" },
            { to: "/strategy-pnl", label: "策略累計盈虧" },
            { to: "/schedule", label: "賽事日程" },
            { to: "/encyclopedia", label: "馬匹百科" },
            { to: "/engine", label: "引擎健康與回測" },
            { to: "/track-record", label: "戰績" },
          ].map((l) => (
            <Link key={l.to} to={l.to} className="rounded-[8px] border border-hairline bg-paper-2 px-3 py-2.5 text-center text-[12px] font-bold text-ink hover:border-gold-strong hover:bg-gold-bg">{l.label}</Link>
          ))}
        </div>
        <p className="mb-1.5 mt-4 font-mono-tx text-[9px] font-bold uppercase tracking-[0.16em] text-ink-3">公開 GitHub 來源</p>
        <a href="https://github.com/sleepingarhat/tianxi-racing" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-[6px] border border-hairline bg-paper px-3 py-1.5 text-[11px] font-bold text-ink hover:border-gold-strong">天喜賽馬數據庫及引擎 ↗</a>
      </section>

      <p className="px-5 pb-6 text-center text-[10px] text-ink-3">以上手機畫面為功能示意，唔係真實預測；真實四揀、賽果同盈虧請睇各功能頁。</p>
    </div>
  );
}
