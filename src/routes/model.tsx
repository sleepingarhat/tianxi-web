import { createFileRoute, Link } from "@tanstack/react-router";

import { AppShell } from "@/components/tx/AppShell";
import { Card, PageHead } from "@/components/tx/ui";
import { ELO, FACTOR_RULES, FEATURES, LGB } from "@/lib/model-spec";
import report from "@/lib/retraining-report.json";
import repair from "@/lib/repair-retraining-report.json";
import calibration from "@/lib/repair-calibration-summary.json";
import impact from "@/lib/cohort-impact-summary.json";
import completeTrainingAsset from "@/assets/reports/training-complete.csv.gz.asset.json";
import trainingAsset from "@/assets/reports/training-rebuilt.csv.gz.asset.json";
import { FreezeRecoveryPanel, recoveryQuery } from "@/components/tx/FreezeRecoveryPanel";
import { RebuildProgressPanel } from "@/components/tx/RebuildProgressPanel";
import { CalibratedFusionPanel } from "@/components/tx/CalibratedFusionPanel";

const TITLE = "模型說明 · Elo 公式與 LightGBM 特徵 · 天喜賽馬";
const DESC = "天喜賽馬模型公式、52項特徵、自動修復即時狀態、逐場巡查日誌、完整重建及逐日校準報告；清楚區分研究驗收與正式升版。";

export const Route = createFileRoute("/model")({
  loader: ({ context }) => context.queryClient.ensureQueryData(recoveryQuery),
  head: () => ({ meta: [
    { title: TITLE },
    { name: "description", content: DESC },
    { property: "og:title", content: TITLE },
    { property: "og:description", content: DESC },
    { property: "og:type", content: "article" },
    { name: "twitter:card", content: "summary" },
  ], links: [{ rel: "canonical", href: "https://tianxi.racing/model" }] }),
  component: ModelPage,
});

const SRC = "https://github.com/sleepingarhat/tianxi-racing/blob/main/backend/";

function Formula({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-md border border-hairline bg-paper-2 p-3 font-mono-tx text-[11px] leading-relaxed text-ink">{children}</pre>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-[12px] leading-relaxed text-ink-2">{children}</p>;
}

function Src({ path }: { path: string }) {
  return <a href={SRC + path} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block break-all font-mono-tx text-[10px] text-gold underline">源碼：{path}</a>;
}

function ModelPage() {
  return <AppShell page="dashboard" ticker="模型說明 · 公式與特徵公開">
    <PageHead en="公開模型" title="模型說明" desc="TX-Oracle v3：Elo 評分加 LightGBM 排名模型。以下內容逐項對照公開源碼，可自行核對。" />

    <div className="mx-4 my-3 flex flex-wrap gap-4 text-[12px] text-gold"><Link to="/prediction-reconciliation">預測分與賽果對帳</Link><Link to="/elo-log">Elo 每日更新</Link><a href="https://github.com/sleepingarhat/tianxi-racing/blob/main/MODEL.md" target="_blank" rel="noopener noreferrer">繁體中文文件</a><a href="https://github.com/sleepingarhat/tianxi-racing/blob/main/MODEL.en.md" target="_blank" rel="noopener noreferrer">English 原始資料</a></div>
    <div className="mx-4 my-3"><P>中文為主要說明；公式及特徵英文識別保留，方便與原始程式逐項對照。overall 指總體軸，gain 指樹分裂改善量，split 指分裂使用次數，LambdaRank 指名次排序訓練。</P></div>
    <FreezeRecoveryPanel />
    <RebuildProgressPanel />
    <CalibratedFusionPanel />
    <Card title="134行影響對照 · 原始分數敏感度" en="未升版／歷史紀錄未核">
      <P>11個賽日讀取1,338筆原預測紀錄，只比較馬匹集合完全一致的{impact.matchedRaces}場／{impact.matchedRunners}匹；15場集合不同排除。134行來源日期為2016年9月3日至2023年6月28日，屬訓練歷史，不是近期134匹預測。</P>
      <P><b>只測134行納入：</b>固定修復後特徵、逐日訓練輪數、原紀錄Elo及因子，對比有／無134行訓練樣本；α固定0.88，以相同標度換算研究分數，但本實驗用原始模型分數，未重播服務使用的校準混合log(p)，所以數字只屬敏感度，不是正式預測影響。亦未重建舊錯誤導入流程。</P>
      <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-3"><div className="text-ink">四揀組合改變<b className="block text-lg">{impact.cohortTop4ChangedRaces}／{impact.matchedRaces}場（5.4%）</b></div><div className="text-ink">研究分數平均差<b className="block text-lg">{impact.cohortMeanAbsScoreDelta.toFixed(2)}分</b></div><div className="text-ink">研究分數最大差<b className="block text-lg">{impact.cohortMaxAbsScoreDelta.toFixed(1)}分</b></div></div>
      <P>{impact.cohortRankChanges}匹排名改變；同批平均四揀命中由{impact.excludedMeanHits.toFixed(3)}升至{impact.includedMeanHits.toFixed(3)}／4，合共增加2匹命中，改善有限，不能當成升版通過。</P>
      <P><b>另作假設式歷史對照：</b>{impact.historicalTop4ChangedRaces}／{impact.matchedRaces}場四揀組合不同，{impact.historicalRankChanges}匹排名不同；平均絕對分差{impact.historicalMeanAbsScoreDelta.toFixed(2)}、最大{impact.historicalMaxAbsScoreDelta.toFixed(1)}分。差異包含重訓及其他資料修復，<b>不能全歸因134行</b>；原紀錄缺不可變發布收據，不能冒充已核實原始鎖點；這些假設式分差不代表134行納入後正式分數的實際改變。</P>
      <P>研究閘仍未完成通過：正式修復後Elo融合重播及缺值處理一致性未驗收；保持現行模型，歷史凍結、原始副本及戰績不改。</P>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-gold"><a href="/reports/cohort-impact-2026-10-18/summary.json" download>條件式研究完整報告</a><a href="/reports/cohort-impact-2026-10-18/comparison.csv" download>1,147匹分數及排名對照</a><a href="/reports/cohort-impact-2026-10-18/source/compare.py" download>可重跑比較程式</a></div>
    </Card>

    <Card title="完整重建與逐日校準 · 最新核對報告" en="未通過升版驗收">
      <P>修復後完整重建 {calibration.rows.toLocaleString()} 行／{calibration.races.toLocaleString()} 場，涵蓋2016年9月3日至2026年10月14日。95欄輸入使用正式52項訓練特徵；134行來源缺配對全部重新納入，場次／馬匹鍵無重複。</P>
      <P>796輪候選模型先用更早資料訓練，於79場驗證校準，再全資料重擬合。11個賽日107場逐日測試只用更早賽日資料，數值健康閘11/11通過。最新τ_elo={calibration.fullTraining.tau_elo.toFixed(3)}，不再貼近100上限；α接近1按現行健康閘不屬失敗。</P>
      <div className="mt-3 grid gap-3 text-[13px] sm:grid-cols-3"><div className="text-ink">候選四揀平均<b className="block text-lg">{calibration.candidateMean.toFixed(2)}／4</b></div><div className="text-ink">同批收市頭四熱門<b className="block text-lg">{calibration.marketMean.toFixed(2)}／4</b></div><div className="text-loss">升版狀態<b className="block text-lg">保持現行模型</b></div></div>
      <P><b>數值健康閘通過不等於升版：</b>候選命中低於同批市場及目標3／4；正式α=0.88融合未重播，近期34行baseline缺值已查明：33匹馬及1位練馬師無嚴格較早快照；導出器要求三軸齊全，與網站可用軸重分配不同，融合對照仍未驗收。以下屬隔離研究預測，收市賠率只作賽後對照，不是正式凍結戰績。</P>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[12px]"><thead className="text-ink-3"><tr><th>賽日</th><th>場數</th><th>候選／4</th><th>市場／4</th><th>數值健康閘</th></tr></thead><tbody className="divide-y divide-hairline">{calibration.days.map(d => <tr key={d.date}><td className="py-2 whitespace-nowrap">{d.date}</td><td>{d.races}</td><td>{d.candidateMean.toFixed(2)}</td><td>{d.marketMean.toFixed(2)}</td><td className="text-brand">通過</td></tr>)}</tbody></table></div>
      <P>10月14日缺可靠原始鎖點副本，未做過正式自動恢復驗收。逐場巡查已部署，沿用5分鐘鎖點；異常事件觸發Telegram通知，通道測試已送達。下一賽日真正捕獲／恢復仍待驗收；任何重訓不改凍結、原始副本或歷史戰績。</P>
      <details className="mt-3 text-[11px] text-ink-2"><summary className="cursor-pointer text-gold">完整輸入及候選模型指紋</summary><p className="mt-2 break-all font-mono-tx">輸入：{calibration.inputSha256}<br />模型：{calibration.fullTraining.model_sha256}</p></details>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-gold"><a href="/reports/repair-calibration-2026-10-18/summary.json" download>完整報告及逐日指標</a><a href="/reports/repair-calibration-2026-10-18/cohort-readback.csv" download>134行納入核對</a><a href={completeTrainingAsset.url} download>完整重建輸入 GZIP</a><a href="/reports/repair-calibration-2026-10-18/model.txt" download>最新候選模型</a><a href="/reports/repair-calibration-2026-10-18/feature-importance.json" download>最新特徵重要性</a>{calibration.days.map(d => <a key={d.date} href={`/reports/repair-calibration-2026-10-18/${d.date}-predictions.csv`} download>{d.date}逐馬預測</a>)}</div>
    </Card>
    <Card title="前次重訓對照 · 歷史研究報告" en="已由上方完整重建接續">
      <P>重新生成歷史特徵後，匹配{repair.trainingRows.toLocaleString()}行／{repair.trainingRaces.toLocaleString()}場、52項特徵；79場969行驗證選定986輪，再全資料重擬合。原102,252行中134行當時未配對，其後已逐行對返來源賽果CSV核實：110行係雙字母馬匹編號（如CL247）未被舊程式認到、跌咗入名稱後備識別，24行係平頭馬名次被舊解析當無效。兩個根源已修復並加回歸測試；134行已在上方最新完整重建重新納入，本節只保留前次研究範圍。</P>
      <P>10月19日11場145匹原始模型分表：{repair.top4SetChanges}場頭四組合、{repair.top4OrderChanges}場頭四次序改變，{repair.rankChanges}匹排名改變；平均絕對log(p)分差{repair.meanAbsDelta.toFixed(5)}，最大{repair.maxAbsDelta.toFixed(5)}。不是網站融合四揀；變化亦包含血統先驗、並頭標籤及來源分母，不能全歸因Elo停更。</P>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[12px]"><thead className="text-ink-3"><tr><th>場次</th><th>匹數</th><th>頭四保留</th><th>排名改變</th></tr></thead><tbody className="divide-y divide-hairline">{repair.races.map(r => <tr key={r.race}><td className="py-2">第{r.race}場</td><td>{r.runners}</td><td>{r.retained}／4</td><td>{r.rankChanges}</td></tr>)}</tbody></table></div>
      <P><b>前次報告不作升版依據：</b>本節是134行重新納入前的歷史研究，當時τ_elo接近100。最新完整重建及逐日校準見上方；舊145匹比較不是最新候選或網站融合四揀，亦不代表凍結分數有被改寫。</P>
      <P>10月14日對帳頁101匹與資料倉賽果逐匹匹配；99匹有名次全部一致，2匹無名次保持未完整。Elo日誌298筆（三軸101／101／96），屬補計快照淨變動，不是當日賽前使用證明；本次非直接向馬會獨立核證。</P>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-gold"><a href="/reports/repair-retraining-2026-10-18/report.json" download>報告及指紋 JSON</a><a href="/reports/repair-retraining-2026-10-18/comparison.csv" download>145匹分數／排名 CSV</a><a href="/reports/repair-retraining-2026-10-18/missing-cohort.csv" download>134行缺配對清單</a><a href="/reports/repair-retraining-2026-10-18/missing-cohort-verified.csv" download>134行逐行核實結論</a><a href={trainingAsset.url} download>訓練輸入 GZIP</a><a href="/reports/repair-retraining-2026-10-18/model.txt" download>候選模型</a><a href="/reports/repair-retraining-2026-10-18/feature-importance.json" download>特徵重要性</a></div>
    </Card>
    <Card title="舊CSV重現對照 · 2026-10-18" en="只讀研究">
      <P>全部102,252行／8,408場／52項特徵；79場驗證選定870輪，再用全部資料重擬合。正式10月19日模型分表11場145匹：四揀改變0／11場、排序改變0／145匹、原始log(p)分數最大差0。序列化模型SHA-256與現行完全相同，未切換模型、權重或正式預測。</P>
      <P><b>限制：</b>用現存完整CSV重訓，並非以修復後v12重新生成全歷史特徵；零差異只證明相同輸入可重現，唔代表停更無影響。公開草稿接口只返回第1場13匹；全分表排序不等於全日公開凍結四揀。網站finalScore不在這次分數比較範圍，亦未有賽果證明改善。</P>
      <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-[12px]"><thead className="text-ink-3"><tr><th>場次</th><th>匹數</th><th>四揀保留</th><th>排序改變</th></tr></thead><tbody className="divide-y divide-hairline">{report.races.map(r => <tr key={r.race}><td className="py-2">第 {r.race} 場</td><td>{r.runners}</td><td>{r.retained}／4</td><td>{r.rankChanges}</td></tr>)}</tbody></table></div>
      <details className="mt-3 text-[11px] text-ink-2"><summary className="cursor-pointer text-gold">來源及指紋</summary><div className="mt-2 break-all font-mono-tx"><p>現行：{report.baselineVersion} · run {report.baselineRun}</p><p>CSV SHA-256：{report.trainingSha256}</p><p>模型 SHA-256：{report.modelSha256}</p><p>LightGBM {report.libraryVersion} · {report.createdAt}</p></div></details>
      <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-gold"><a href="/reports/retraining-2026-10-18.csv" download>逐馬排名／分數 CSV</a><a href="/reports/retraining-2026-10-18.json" download>完整 JSON 證據</a></div>
    </Card>
    <Card title="融合公式" en="融合計算">
      <Formula>{`blendZ     = α · lgb_z + (1 − α) · elo_z      α = ${LGB.alpha}
排名分      = blendZ + 0.5 · (factor_bonus ÷ 100)
finalScore = 1500 + blendZ × 100      （顯示用，唔包 factor）`}</Formula>
      <P>lgb_z、elo_z 係同一場內各自標準化（減平均、除標準差）。冇 LightGBM 分嘅馬以全場平均代入。現行正式預測嘅 factor_bonus 只計檔位同負磅兩項。</P>
      <Src path="src/routes/analyze.ts" />
    </Card>

    <Card title="Elo 更新公式" en="Elo">
      <Formula>{`對每對參賽者 i、j：
expected_i = 1 / (1 + 10^((R_j − R_i) / 400))
K_eff_i   = K_base × exp(−距上仗日數 / τ) × 暫定倍率
delta_i   = Σ K_eff_i / (N − 1) × (實際得分 − expected_i)
K_base：馬 ${ELO.k.horse}／騎師 ${ELO.k.jockey}／練馬師 ${ELO.k.trainer}
τ（日）：馬 ${ELO.tau.horse}／騎師 ${ELO.tau.jockey}／練馬師 ${ELO.tau.trainer}
暫定倍率：更新前少於 ${ELO.provisionalGames} 仗 → ×${ELO.provisionalMultiplier}，其餘 ×1`}</Formula>
      <P>N 為有效比較人數；實際得分：名次較好為1、較差為0、同名次為0.5。未完成（名次999）不參與配對。初出無上仗日數時不衰減；一般起步評分{ELO.initial}，進口馬1580、自購馬1560。外地騎師1550係可用設定，但原批次程式未傳入該標記，不宣稱已採用。</P>
      <Formula>{`可信度 = min(1, 出賽數 / 20) × (1 − exp(−近期加權出賽數 / 6))
普通更新：近期加權出賽數 = 舊值 × exp(−距上仗日數 / τ) + 1`}</Formula>
      <P>可信度係出賽量與新鮮度指標，唔係命中機率。馬匹休息超365日至720日暫停更新自身變動，超720日列退役；騎師／練馬師相應門檻為730／1095日。馬季回歸系數：馬5%、騎師及練馬師2%，拉近1500；原程式跨曆年亦會觸發，唔只係7月31日。2017年年底或之前的快照另有暖機標記。</P>
      <Formula>{`elo_composite = (0.7 × 馬匹 + 0.2 × 騎師 + 0.1 × 練馬師) ÷ 有資料權重之和`}</Formula>
      <P>馬匹有overall軸，另按草地／泥地×途程分軸儲存（短途≤1400、一哩≤1800、中距≤2000、其餘長途）。草地常見軸為 {ELO.axes.join("、")}；唔係固定只得五軸。正式預測<b>只讀overall軸</b>，所以冇五軸融合權重；騎師與練馬師各自只有overall評分。以上綜合權重係預測層設定，唔係Elo更新公式。</P>
      <Src path="scripts/elo/engine_v12.ts" />
      <Src path="scripts/elo/compute_v12.ts" />
      <P>2026-10-17核查更新流程錯配：真正v12快照曾停在4月15日，現已補計至10月14日；舊凍結預測與鎖定紀錄不改。補計評分唔代表原賽前已使用，亦不保證命中率提高。</P>
    </Card>

    <Card title="LightGBM 訓練" en="排名訓練">
      <div className="grid gap-1 text-[12px] text-ink-2">
        <div>目標：{LGB.objective}；評估：{LGB.metric}；截斷：前 {LGB.truncation} 名</div>
        <div>標籤：{LGB.labels}</div>
        <div>label_gain：{LGB.labelGain}</div>
        <div>缺失值：{LGB.missing}</div>
        <div>類別特徵：{LGB.categorical}</div>
        <div>輪數：以早停搵最佳輪數，再用全部資料重訓</div>
        <div>日期限制：往績只用賽日之前資料；血統先驗修復仍屬候選；唔用賠率</div>
      </div>
      <Src path="scripts/backtest/predict_upcoming.py" />
      <P>正式訓練新增保存序列化模型嘅gain（樹分裂改善量）及split（使用次數），各自列百分比、保留零值與訓練欄序，附模型及設定檔指紋。不是單馬SHAP、因果或Elo貢獻，亦不自動升版；首份正式完整重訓報告仍待驗收。</P>
    </Card>

    <Card title={`特徵清單（${FEATURES.length} 項）`} en="特徵衍生與編碼">
      <ol className="divide-y divide-hairline">
        {FEATURES.map((f, i) => <li key={f.name} className="grid gap-0.5 py-2 sm:grid-cols-[2rem_12rem_6rem_1fr_9rem] sm:gap-3">
          <span className="font-mono-tx text-[10px] text-ink-3">{i + 1}</span>
          <span className="break-all font-mono-tx text-[11px] font-bold text-ink">{f.name}</span>
          <span className="text-[11px] text-gold">{f.group}</span>
          <span className="text-[12px] leading-relaxed text-ink-2">{f.derive}</span>
          <span className="text-[11px] text-ink-3">{f.encode}</span>
        </li>)}
      </ol>
      <Src path="scripts/backtest/dump-features.ts" />
    </Card>

    <Card title="factor_bonus 規則分" en="規則因子">
      <Formula>{`rate(出賽, 頭三, scale) = ((頭三 + 0.30 × 5) ÷ (出賽 + 5) − 0.30) × scale　；冇往績 = 0`}</Formula>
      <div className="mt-2 divide-y divide-hairline text-[12px]">
        {FACTOR_RULES.map((r) => <div key={r.name} className="flex gap-3 py-1.5"><b className="w-10 shrink-0 text-ink">{r.name}</b><span className="text-ink-2">{r.rule}</span></div>)}
      </div>
      <P>訓練特徵入面嘅 factor_bonus 係六項之和；正式預測加分只計檔位同負磅。</P>
    </Card>

    <Card title="測試過但未採用" en="未採用研究">
      <P>試閘、場內相對值、配備變化、分段速度 z 值、賽後評述（受阻／走大疊／出閘失準）：經 1,299 場 walk-forward A/B 測試，命中率冇穩定改善，未用於正式預測。長休復出、班次適應、騎練180日勝率等只喺回測檔，未升正式版。</P>
    </Card>
  </AppShell>;
}
