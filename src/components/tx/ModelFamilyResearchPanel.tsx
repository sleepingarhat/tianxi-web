import type { ModelFamilyReport } from '@/lib/model-family-report';
import training from '@/assets/reports/training-complete.csv.gz.asset.json';
import { Card, Pill, Scroller, Table, Td } from './ui';

export function ModelFamilyResearchPanel({ report }: { report: ModelFamilyReport }) {
  const names = ['LightGBM', 'XGBoost', 'Random Forest'];
  return <Card title="三模型研究 · 四揀平均命中匹數" en="真實歷史資料 · 逐日留出回測" className="lg:col-span-2">
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-2"><Pill tone="gold">探索性研究 · 未升版</Pill><span>{report.dates[0]} 至 {report.dates.at(-1)} · {report.dates.length}賽日 · {report.summary[0]?.races}場</span></div>
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {report.summary.map(m => <div key={m.name} className="min-w-0 border-l-2 border-gold pl-3">
        <h3 className="text-[13px] font-bold text-ink">{m.name}</h3>
        <p className="mt-2 font-mono-tx text-2xl font-bold text-ink">{m.averageHits.toFixed(3)}<span className="text-sm text-ink-3">／4</span></p>
        <p className="mt-2 text-[11px] text-ink-2">合共中{m.hits}匹／{m.races}場</p>
        <p className="mt-1 text-[10px] text-ink-3">95%賽日區間 {m.ci95[0]?.toFixed(3)}–{m.ci95[1]?.toFixed(3)}</p>
      </div>)}
    </div>
    <p className="mt-4 text-[12px] leading-relaxed text-ink-2">三模型共用{report.features.length}項欄位、每個賽日前全部完整歷史場次、缺值填−1，固定{report.trees}棵樹及種子{report.seed}；每場選最高分4匹，命中＝所選馬與官方頭四名交集，總命中匹數÷場數。目標日全日不入訓練，唔用賠率、賽後落後距離或最終分數作輸入。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2"><b>唔係正式集成戰績：</b>本檔{report.sourceRows.toLocaleString()}行／{report.sourceRaces.toLocaleString()}場，完整性篩選保留{report.completeRaces.toLocaleString()}場、排除{report.excludedRaces}場。Elo作同一批輸入特徵，缺值一致填−1；比較係模型本體，唔代表正式LGB＋Elo分數混合。歷史特徵採現存重建，來源層賽前時間未逐筆驗證，結果只適用本次參數。</p>
    <div className="mt-4"><Scroller><Table head={['賽日', '場數', ...names.map(n => `${n}／4`)]}>
      {report.days.map(day => <tr key={day.date} className="border-t border-hairline"><Td first>{day.date}</Td><Td>{day.races.length}</Td>{names.map(name => <Td key={name}>{(day.races.reduce((sum, r) => sum + (r.models[name]?.hits ?? 0), 0) / day.races.length).toFixed(3)}</Td>)}</tr>)}
    </Table></Scroller></div>
    <details className="mt-3 text-[11px] leading-relaxed text-ink-2"><summary className="cursor-pointer py-2 text-gold">研究限制及資料指紋</summary><ul className="list-disc space-y-1 pl-4">{report.limitations.map(t => <li key={t}>{t}</li>)}</ul><p className="mt-3 break-all font-mono-tx">輸入SHA-256：{report.inputSha256}</p></details>
    <div className="mt-3 flex flex-wrap gap-4 text-[12px] font-bold text-gold"><a href="/reports/model-family-2026-10-21/summary.json" download>完整結果及逐場四揀</a><a href="/reports/model-family-2026-10-21/source.py" download>可重跑研究程式</a><a href={training.url} download>歷史輸入資料</a></div>
  </Card>;
}