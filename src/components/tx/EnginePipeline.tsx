// 天喜 · 引擎八步流程（可展開）：超精簡標題 ＋ 展開白話解釋 ＋ 數學公式
import { useState } from "react";

type Step = {
  n: string;
  title: string;
  one: string;
  /** 呢一步會唔會改動最終四揀排名 */
  affects: boolean;
  detail: string[];
  /** 數學公式／方程式（逐條顯示） */
  math?: { label: string; eq: string; note?: string }[];
};

const STEPS: Step[] = [
  {
    n: "01",
    title: "收料",
    one: "排位表一出即有初版預測",
    affects: true,
    detail: [
      "馬會出排位表之後，引擎即刻抽取出賽名單、檔位、負磅、騎師練馬師，加上歷史賽果、晨操、分段時間、血統資料。",
      "所有歷史資料一律只用「賽日之前」嘅紀錄，唔會用到當日賽果，避免偷答案。",
    ],
    math: [
      {
        label: "As-of 取料條件",
        eq: "x_i(t) = f( { 紀錄 r : date(r) < t } )",
        note: "t＝賽日；任何 date(r) ≥ t 嘅紀錄一律剔除（防資料洩漏）。",
      },
    ],
  },
  {
    n: "02",
    title: "天喜ELO 三軸",
    one: "馬 0.7 ／ 騎師 0.2 ／ 練馬師 0.1",
    affects: true,
    detail: [
      "由 2016 年起逐場重播每場賽事，場內兩兩比較：贏高分對手加得多，輸熱門扣得少。起步分 1500。",
      "馬匹、騎師、練馬師各有獨立一條 ELO，用同一場結果分別更新自己嗰條，出預測時按 0.7／0.2／0.1 合成。",
      "新馬冇對戰紀錄：有官方評分就用評分推起步分，冇就用同班次基準；信心度低嘅時候會自動調低馬匹軸權重。",
    ],
    math: [
      { label: "對手預期勝率", eq: "E_ij = 1 / ( 1 + 10^((R_j − R_i) / 400) )" },
      {
        label: "單場更新（場內平攤）",
        eq: "ΔR_i = K / (N − 1) × Σ_{j≠i} ( S_ij − E_ij ),  K = 40",
        note: "S_ij = 1 贏、0 負、0.5 並列；N＝出賽匹數；退出／墜馬不計。",
      },
      { label: "三軸合成", eq: "ELO_comp = 0.7·R_horse + 0.2·R_jockey + 0.1·R_trainer" },
      {
        label: "新馬起步分",
        eq: "R_0 = 1500 + (rating − 60) × 8　｜　無評分：R_0 = classBaseline(class)",
        note: "信心度 c ≈ 0.4（有評分）／0.2（無評分）。",
      },
    ],
  },
  {
    n: "03",
    title: "十項場次因子",
    one: "全部展示，排名只採用檔位＋負磅",
    affects: true,
    detail: [
      "同場對賽、同程、檔位、最快時間、最快末段、騎練合作、近況、同場地、休息日數、負磅共十項，全部喺選馬頁逐項排名俾你自己睇。",
      "生產排名只計入檔位同負磅兩項作微調；其餘八項屬解釋用途，因為佢哋嘅資訊已經被天喜LGB 以更細緻嘅方式吸收。",
    ],
    math: [
      { label: "因子微調", eq: "factorBonus = w_draw·g(draw) + w_wt·h(weight)" },
      {
        label: "落到最終分嘅份額",
        eq: "factorTilt = factorBonus / 100 × 0.5",
        note: "0.5 倍係 A/B 實測結果：拆走會令首選命中率明顯下跌。",
      },
    ],
  },
  {
    n: "04",
    title: "天喜LGB",
    one: "每日 04:00 重訓 · 52 項特徵",
    affects: true,
    detail: [
      "LightGBM 排序模型（LambdaRank），每日凌晨 04:00 用最新賽果重新訓練，同場馬匹互相比較排先後。",
      "採用 52 項特徵，最重要嘅係近 5 場加權平均名次，其次係騎師 ELO、加權上名率、練馬師 ELO、同檔上名率。",
      "如果某場資料不足以出 LGB 分，該場自動退回天喜ELO 基準，網站會標明。",
    ],
    math: [
      { label: "模型輸出", eq: "s_i = Σ_{m=1..M} f_m(x_i),  f_m ∈ 決策樹" },
      {
        label: "訓練目標（LambdaRank）",
        eq: "L = Σ_{(i,j)} |ΔNDCG_ij| · log( 1 + e^{−σ(s_i − s_j)} )",
        note: "只喺同一場（同 group）內兩兩比較，所以 s_i 係無單位嘅相對分——永遠負數都正常，同場比大小才有意義。",
      },
    ],
  },
  {
    n: "05",
    title: "集成混合",
    one: "z 標準化後按 α 混合（α 可由後端設定）",
    affects: true,
    detail: [
      "兩個模型分數先各自同場標準化（消除量級差異），再以 α 混合，最後加上檔位／負磅嘅細微傾斜。",
      "α＝天喜LGB 份額；α = 0 即完全退回純天喜ELO＋因子（緊急開關），α = 1 即純天喜LGB。現行值由後端設定決定，並會喺選馬頁標示。",
      "健康閘會監察 LGB 覆蓋率同資料新鮮度：不合格就調低 LGB 份額、極端情況全部退回 ELO。",
    ],
    math: [
      { label: "同場標準化", eq: "z_i = ( v_i − mean(v) ) / sd(v)" },
      { label: "混合分", eq: "blend_i = α · z^{LGB}_i + (1 − α) · z^{ELO}_i" },
      { label: "最終分（顯示用）", eq: "final_i = 1500 + 100 × blend_i" },
      {
        label: "排序分",
        eq: "score_i = blend_i + factorTilt_i",
        note: "冇 LGB 分嘅馬匹以 z^{LGB} = 0（全場平均）填補，唔會被無理扣分。",
      },
    ],
  },
  {
    n: "06",
    title: "Harville 機率",
    one: "算出前三／前四機率，取 TOP 4",
    affects: false,
    detail: [
      "把集成分數轉成實力值，第一名機率＝該馬實力值 ÷ 全場總和；再假設第一名抽走，喺剩餘馬匹重複計第二、三、四名。",
      "呢一步唔會改動 TOP 4 名單（排序等同分數排序），佢嘅作用係提供準確嘅前三／前四命中機率同箱形覆蓋率（例如揀 5 匹入前三嘅機率）。",
    ],
    math: [
      { label: "實力值", eq: "w_i = e^{ score_i − max(score) }" },
      { label: "獨贏機率", eq: "P(win_i) = w_i / Σ_j w_j" },
      {
        label: "順序機率（Plackett–Luce）",
        eq: "P(i≻j≻k) = w_i/Σ_all · w_j/(Σ_all − w_i) · w_k/(Σ_all − w_i − w_j)",
      },
      {
        label: "前三／前四邊際",
        eq: "P(top3_i) = Σ_{排列含 i 於首三} P(排列)",
        note: "深度 4 精確枚舉；超過 16 匹自動退回 softmax 近似。",
      },
      {
        label: "箱形覆蓋率",
        eq: "Cov(B) = P( 首三名全部 ∈ B ),  |B| = 4 或 5",
      },
    ],
  },
  {
    n: "07",
    title: "市場盤口對照",
    one: "純對照，零權重",
    affects: false,
    detail: [
      "獨贏賠率只用嚟顯示同對照（睇下引擎搏冷定跟熱），完全唔會影響排名。",
      "咁樣做嘅原因：賠率係大眾意見，一旦入模型預測就會跟熱門走，失去搏冷價值，命中率評核亦唔再獨立。",
    ],
    math: [
      { label: "市場隱含機率", eq: "q_i = (1 / O_i) / Σ_j (1 / O_j)" },
      {
        label: "價值差（只作顯示）",
        eq: "edge_i = P(win_i) − q_i",
        note: "edge > 0 標為 overlay（引擎認為市場低估）；權重 0，不入 score。",
      },
    ],
  },
  {
    n: "08",
    title: "鎖定與對帳",
    one: "首場開跑前 90 分鐘一次鎖全日＝最終版",
    affects: true,
    detail: [
      "鎖定之前引擎仍會因為重訓、退馬、資料補齊而更新預測，所以早出嘅名單屬「初版」（黃燈）。",
      "全日只鎖一次：第一場開跑前 90 分鐘做最後一次計算，之後任何重算都寫唔入，全日即為「最終版」（綠燈），只准補名次。",
      "賽後預測與賽果逐場對帳，主指標係四揀平均中匹數；只計最終版。",
    ],
    math: [
      { label: "鎖定時間", eq: "t_lock = 首場 t_post − 90 分鐘（全日一次）" },
      {
        label: "主指標",
        eq: "四揀平均中匹數 = ( 1/R ) Σ_{r=1..R} | TOP4_r ∩ 實際首四_r |",
        note: "R＝已對帳場數；0～4 匹。",
      },
    ],
  },
];

export function EnginePipeline({ defaultOpen }: { defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen ?? null);
  return (
    <div className="space-y-1.5">
      {STEPS.map((s, i) => {
        const isOpen = open === i;
        return (
          <div key={s.n} className="overflow-hidden rounded-[8px] border border-hairline bg-paper">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center gap-2 px-2.5 py-2 text-left"
            >
              <span className="tabnum shrink-0 rounded-[4px] bg-deep px-1.5 py-1 font-mono-tx text-[11px] font-bold leading-none text-deep-fg">
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="block font-serif-tc text-[13px] font-bold leading-tight text-ink">{s.title}</span>
                <span className="block text-[11px] leading-tight text-ink-3">{s.one}</span>
              </span>
              <span
                className={`ml-auto shrink-0 rounded-[4px] border px-1.5 py-[2px] text-[10px] font-bold leading-none ${
                  s.affects ? "border-gold-strong/40 bg-gold-bg text-gold" : "border-hairline bg-paper-3 text-ink-3"
                }`}
              >
                {s.affects ? "影響排名" : "不影響排名"}
              </span>
              <span className="shrink-0 text-[11px] text-ink-3">{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen ? (
              <div className="border-t border-hairline bg-paper-2 px-2.5 py-2">
                {s.detail.map((d, k) => (
                  <p key={k} className="mb-1.5 text-[11px] leading-relaxed text-ink-2 last:mb-0">
                    {d}
                  </p>
                ))}
                {s.math?.length ? (
                  <div className="mt-2 space-y-1.5 border-t border-hairline pt-2">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-ink-3">
                      數學公式 · Formulas
                    </div>
                    {s.math.map((m, k) => (
                      <div key={k} className="rounded-[6px] border border-hairline bg-paper px-2 py-1.5">
                        <div className="text-[11px] font-bold text-ink-2">{m.label}</div>
                        <div className="tabnum mt-0.5 overflow-x-auto whitespace-pre font-mono-tx text-[11px] leading-relaxed text-ink">
                          {m.eq}
                        </div>
                        {m.note ? (
                          <div className="mt-0.5 text-[10px] leading-relaxed text-ink-3">{m.note}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
