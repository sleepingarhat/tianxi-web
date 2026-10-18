import { Card } from './ui';
import report from '@/lib/pedigree-ablation-summary.json';
import evidence from '@/assets/reports/pedigree-ablation-2026-10-19.tar.gz.asset.json';

export function PedigreeResearchPanel() {
  return <Card title="初出馬血統 · 逐日有／無對照" en="只讀研究 · 暫不加重">
    <p className="text-[12px] leading-relaxed text-ink-2">已按馬會官方馬匹頁補齊13匹舊馬父系、母系及外祖父；本次訓練範圍5,812匹馬嘅父系／外祖父缺值為0。102,252行血統特徵重建只用較早賽日後代成績及整體先驗，平滑強度維持40；正式模型與凍結紀錄不變。</p>
    <div className="mt-3 grid grid-cols-2 gap-3 text-[12px] text-ink"><div>有血統 · 四揀平均<b className="block font-mono-tx text-lg">{report.withMeanHits.toFixed(3)}／4</b></div><div>無血統 · 四揀平均<b className="block font-mono-tx text-lg">{report.withoutMeanHits.toFixed(3)}／4</b></div></div>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2">11賽日107場中，26場含33匹本地初出馬；上述平均只計該26場全場四揀，兩分支均命中50匹。全107場為{report.withAllMeanHits.toFixed(3)}對{report.withoutAllMeanHits.toFixed(3)}／4。每分支只選到2匹初出馬，均未命中，<b>樣本及入選數不足，未見穩定改善證據，唔代表血統無用。</b></p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[11px]"><thead className="text-ink-3"><tr><th>賽日</th><th>初出馬場</th><th>有血統／4</th><th>無血統／4</th></tr></thead><tbody className="divide-y divide-hairline">{report.days.map(d => <tr key={d.date}><td className="whitespace-nowrap py-2">{d.date}</td><td>{d.debutRaces}</td><td>{d.debutRaces ? (d.withHits/d.debutRaces).toFixed(2) : '—'}</td><td>{d.debutRaces ? (d.withoutHits/d.debutRaces).toFixed(2) : '—'}</td></tr>)}</tbody></table></div>
    <p className="mt-2 text-[11px] leading-relaxed text-ink-3">相同訓練行、seed 42及逐日輪數；52對49特徵只移除三項血統。校準只用更早賽日；本地首次出賽不等於海外首次出賽。現存血統身份不是歷史鎖點；本次只重建血統三欄，並非完整正式新馬seed重播，不能當升版驗收。早熟程度尚未有核實評估。</p>
    <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-gold"><a href="/reports/pedigree-ablation-2026-10-19/summary.json" download>完整研究報告</a><a href="/reports/pedigree-ablation-2026-10-19/races.csv" download>逐場命中對照</a><a href="/reports/pedigree-ablation-2026-10-19/verified-pedigree-supplement.json" download>13匹官方血統來源</a><a href={evidence.url} download>完整模型及重建證據</a></div>
  </Card>;
}