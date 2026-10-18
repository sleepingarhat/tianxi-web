import { Card, Pill, Stat } from "@/components/tx/ui";
import fusion from "@/lib/calibrated-fusion-summary.json";
import { canPromoteModel } from "@/lib/model-release-gate";

export function CalibratedFusionPanel() {
  const eligible = canPromoteModel({ calibratedServingReplay: false, missingAxisParity: false,
    dailyResearchGate: "UNVERIFIED", immutableHistoryVerified: false });
  return <Card title="134行 · 校準融合對照" en="新研究已完成／正式服務一致性未驗收" action={<Pill tone="lose">{eligible ? "可驗收" : "不升版"}</Pill>}>
    <p className="text-[12px] leading-relaxed text-ink-2">11個賽日重算校準混合 log(p)，再依外層 α=0.88、場內標準化及1500＋100×融合值計分。完整配對{fusion.matchedRaces}場／{fusion.matchedRunners.toLocaleString()}匹；{fusion.excludedIncompleteRaces}場馬匹集合不一致排除。這次不是原始 margin 對照，但仍是隔離研究，未冒充正式服務驗收。</p>
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat label="四揀組合改變" value={`${fusion.cohortTop4ChangedRaces}／${fusion.matchedRaces}場`} />
      <Stat label="平均絕對分差" value={fusion.cohortMeanAbsScoreDelta.toFixed(2)} />
      <Stat label="最大絕對分差" value={fusion.cohortMaxAbsScoreDelta.toFixed(1)} />
      <Stat label="排名改變" value={`${fusion.cohortRankChanges}匹`} />
    </div>
    <p className="mt-3 text-[12px] leading-relaxed text-ink-2">固定修復後52項特徵及逐日輪數，只比較訓練有／無134行，兩邊分別用更早資料校準。同批四揀平均由{fusion.excludedMeanHits.toFixed(3)}變為{fusion.includedMeanHits.toFixed(3)}／4，增加1匹命中；不是已證明正式版改善，也不是對舊錯誤導入流程的完整重建。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-ink-2"><b>另對原歷史分數：</b>{fusion.historicalTop4ChangedRaces}場四揀不同，平均絕對差{fusion.historicalMeanAbsScoreDelta.toFixed(2)}分、最大{fusion.historicalMaxAbsScoreDelta.toFixed(1)}分；包含多項修復與重訓，不能全歸因134行，原歷史紀錄亦缺不可變發布收據。</p>
    <p className="mt-2 text-[12px] leading-relaxed text-loss"><b>升版仍阻截：</b>現行只讀逐場重建與正式會期批量因子、未四捨五入Elo的完整一致性尚未核實；baseline缺值由{fusion.baselineMissingBefore.toLocaleString()}行減至{fusion.baselineMissingAfter}行，但全軸缺值仍需正式契約驗收。研究表現仍未達目標3／4，不把本報告標PASS。</p>
    <details className="mt-3 text-[12px] text-ink-2"><summary className="cursor-pointer text-gold">新校準逐日進度與參數</summary><ol className="mt-2 divide-y divide-hairline">{fusion.days.map(day => <li key={day.date} className="py-3"><b className="font-mono-tx text-ink">{day.date} · 配對{day.matchedRaces}場</b><p className="mt-1 leading-relaxed">訓練至{day.train_end}；驗證{day.validation_start}至{day.validation_end}。</p><p className="mt-1 font-mono-tx text-[11px]">納入：τ LGB {day.calibration.included.tau_lgb.toFixed(3)}／Elo {day.calibration.included.tau_elo.toFixed(3)}／α {day.calibration.included.inner_alpha.toFixed(6)}</p><p className="mt-1 font-mono-tx text-[11px]">排除：τ LGB {day.calibration.excluded.tau_lgb.toFixed(3)}／Elo {day.calibration.excluded.tau_elo.toFixed(3)}／α {day.calibration.excluded.inner_alpha.toFixed(6)}</p><a className="mt-2 inline-block text-gold" href={`/reports/calibrated-fusion-2026-10-18/${day.date}.json`} download>該日融合校準原檔</a></li>)}</ol></details>
    <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-gold"><a href="/reports/calibrated-fusion-2026-10-18/summary.json" download>新融合報告</a><a href="/reports/calibrated-fusion-2026-10-18/comparison.csv" download>1,105匹分數對照</a><a href="/reports/calibrated-fusion-2026-10-18/execution.log" download>真實逐日執行日誌</a><a href="/reports/calibrated-fusion-2026-10-18/evidence.json" download>來源與指紋</a><a href="/reports/calibrated-fusion-2026-10-18/source/replay.py" download>可重跑研究程式</a></div>
    <p className="mt-3 text-[12px] leading-relaxed text-ink-3">本次沒有寫入生產預測、原始副本或歷史战績。沒有可靠副本的舊賽日仍不作自動恢復驗收；原始分數敏感度舊報告保留在下方分開對照。</p>
  </Card>;
}