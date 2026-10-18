import { Card, Pill, Stat } from "@/components/tx/ui";
import fusion from "@/lib/meeting-seed-summary.json";

export function CalibratedFusionPanel() {
  return <Card title="134行 · 校準融合對照" en="新馬契約通過／升版證據待驗收" action={<Pill tone="lose">未升版</Pill>}>
    <p className="text-[12px] leading-relaxed text-ink-2">正式會期流程隔離重播11個賽日、{fusion.fullFieldRaces}場／{fusion.fullFieldRunners.toLocaleString()}匹；重新套用融合公式，finalScore最大分差{fusion.fullFieldScoreParityMax.toFixed(1)}。只證明現行公式可重現，不代表修復候選已通過升版驗收。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2">固定正式會期Elo及因子，有／無134行兩邊分別用更早資料校準log(p)，外層α=0.88。完整配對{fusion.matchedRaces}場／{fusion.matchedRunners.toLocaleString()}匹，{fusion.excludedRaces}場馬匹集合不一致排除；以下是條件式研究影響，並非正式預測已改變。</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="四揀組合改變" value={`${fusion.cohortTop4ChangedRaces}／${fusion.matchedRaces}場`} />
      <Stat label="平均絕對分差" value={fusion.cohortMeanAbsScoreDelta.toFixed(2)} />
      <Stat label="最大絕對分差" value={fusion.cohortMaxAbsScoreDelta.toFixed(1)} />
      <Stat label="排名改變" value={`${fusion.cohortRankChanges}匹`} />
    </div>
    <p className="mt-3 text-[12px] leading-relaxed text-ink-2">同批四揀平均命中由{fusion.excludedMeanHits.toFixed(3)}變為{fusion.includedMeanHits.toFixed(3)}／4，178→181匹、增加3匹；固定修復後52項特徵、Elo及逐日輪數，只比較訓練有／無134行，不是對舊錯誤導入流程的完整重建。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2"><b>另對原歷史分數：</b>{fusion.historicalTop4ChangedRaces}場四揀不同，平均絕對差{fusion.historicalMeanAbsScoreDelta.toFixed(2)}分、最大{fusion.historicalMaxAbsScoreDelta.toFixed(1)}分；包含多項修復與重訓，不能全歸因134行。歷史資料缺不可變發布收據，不能冒充全部原鎖點證據。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2"><b>新馬分支已核對：</b>19個賽日{fusion.seedContract.runners.toLocaleString()}匹，含{fusion.seedContract.seeded}匹起始Elo估值；研究重播沿用正式評分／班次及可信度，未四捨五入綜合Elo最大誤差小於0.000000001，公開值一致。9項新馬測試及6項39行相容測試通過；11賽日校準按此基準重新計算。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2"><b>39行已逐行核實並豁免：</b>對全部歷史賽果CSV逐匹核對，39／39匹嘅首次出賽就係缺值嗰日——全部係初出馬，賽前Elo快照從來唔可能存在，缺值係正確表示；影響39行／102,252行（0.038%），唔再阻截升版。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-loss"><b>升版仍阻截：</b>新校準完整發布檔、研究閘PASS及原子發布收據仍欠缺。52項原始訓練特徵未改，不能宣稱全歷史訓練已等價。3／4是長遠目標，不另造硬閘；數值健康通過不等於升版。</p>
    <details className="mt-3 text-[12px] text-ink-2"><summary className="cursor-pointer text-gold">正式全場重播逐日日誌</summary><ol className="mt-2 divide-y divide-hairline">{fusion.days.map(day => <li key={day.date} className="py-2 font-mono-tx">{day.date} · 配對{day.matchedRaces}場 · 四揀改變{day.cohortTop4Changed}場 · 排名改變{day.rankChanges}匹</li>)}</ol></details>
    <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-gold">
      <a href="/reports/meeting-seed-calibration-2026-10-18/summary.json" download>新馬契約融合報告</a>
      <a href="/reports/meeting-seed-calibration-2026-10-18/comparison.csv" download>{fusion.matchedRunners.toLocaleString()}匹分數對照</a>
      <a href="/reports/meeting-seed-calibration-2026-10-18/execution.log" download>真實全場執行日誌</a>
      <a href="/reports/meeting-seed-calibration-2026-10-18/evidence.json" download>來源與不可變核對</a>
      <a href="/reports/meeting-seed-calibration-2026-10-18/calibration.json" download>11賽日新校準参数</a>
      <a href="/reports/serving-parity-2026-10-18/missing-axis-contract.md" download>39行缺值契約</a>
      <a href="/reports/serving-parity-2026-10-18/missing-axis-39.csv" download>39行來源清單</a>
      <a href="/reports/calibrated-fusion-2026-10-18/summary.json" download>先前隔離校準報告（89場）</a>
    </div>
    <p className="mt-3 text-[12px] leading-relaxed text-ink-3">預測表14,021行、鎖點描述1行、原始副本表0行前後SHA-256完全相同；表行數不等於真正賽前凍結數目。沒有可靠副本的舊賽日仍不作自動恢復驗收；未升版、未發布。</p>
  </Card>;
}
