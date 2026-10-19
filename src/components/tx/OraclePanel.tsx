import type { PickRow } from "@/lib/racing-shapes";
// 天喜 · 監控台：即日 TX-Oracle v3 預測（沿用舊監控端排版：每場摺疊卡 + 全欄表）
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useState } from "react";

import { Empty, ErrorNote, Loading } from "@/components/tx/ui";
import { getOraclePicks } from "@/lib/picks.functions";

const FACTOR_KEYS = [
  "recency",
  "distance",
  "going",
  "draw",
  "weight",
  "condition",
  "injury",
  "jtCombo",
] as const;

function pct(v: number | null | undefined) {
  return v == null ? "—" : (v * 100).toFixed(1) + "%";
}
function elo(v: number | null | undefined) {
  return v == null ? "—" : String(Math.round(v));
}
function lgbApplied(r: any) {
  if (r?.lgbCoverage && typeof r.lgbCoverage.applied === "boolean") return r.lgbCoverage.applied;
  const m = typeof r?.scoreSource === "string" ? r.scoreSource.match(/lgb=([0-9]+)/) : null;
  return Boolean(m && Number(m[1]) > 0);
}

function FactorCell({ bonus, breakdown }: { bonus?: number | null; breakdown?: PickRow['factorBreakdown'] }) {
  if (bonus == null) return <span className="text-ink-3">—</span>;
  const tone = bonus > 0 ? "text-win" : bonus < 0 ? "text-lose" : "text-ink-2";
  const lines = FACTOR_KEYS.flatMap((k) => { const c = breakdown?.[k]; return c ? [{ k, bonus: Number(c.bonus ?? 0), note: c.note ?? null }] : []; });
  return (
    <div>
      <span className={`tabnum font-semibold ${tone}`}>
        {bonus >= 0 ? "+" : ""}
        {Number(bonus).toFixed(1)}
      </span>
      {lines.length ? (
        <details className="mt-0.5">
          <summary className="cursor-pointer text-[10px] text-ink-3">明細</summary>
          <div className="mt-1 space-y-0.5">
            {lines.map((f) => (
              <div key={f.k} className="whitespace-nowrap text-[10px] leading-tight">
                <span className={f.bonus > 0 ? "text-win" : f.bonus < 0 ? "text-lose" : "text-ink-3"}>
                  {f.bonus >= 0 ? "+" : ""}
                  {Number(f.bonus).toFixed(1)}
                </span>{" "}
                <span className="text-ink-3">{f.note}</span>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function RaceCard({ race, defaultOpen }: { race: any; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const picks: any[] = race.picks ?? [];
  const top = picks[0];

  const TH = ({ children, right, center }: { children: React.ReactNode; right?: boolean; center?: boolean }) => (
    <th
      className={`whitespace-nowrap border-b border-hairline bg-paper-3 px-2 py-1.5 text-[10px] font-medium tracking-wide text-ink-2 ${
        right ? "text-right" : center ? "text-center" : "text-left"
      }`}
    >
      {children}
    </th>
  );

  return (
    <div className="mb-2.5 overflow-hidden rounded-[8px] border border-hairline bg-paper">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 bg-paper-2 px-3 py-2.5 text-left"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-deep text-[14px] font-bold text-deep-fg">
          {race.raceNumber}
        </span>
        <span className="flex-1">
          <span className="block text-[13px] font-semibold text-ink">{race.title || `第 ${race.raceNumber} 場`}</span>
          <span className="block text-[11px] text-ink-3">
            {race.distance ? `${race.distance}m` : ""}
            {race.going ? ` · ${race.going}` : ""}
            {race.class ? ` · ${race.class}` : ""} · {picks.length} 匹 ·{" "}
            {race.marketReady ? <span className="text-win">市場欄 ✓</span> : <span>市場欄 等盤口</span>}
            {race.raceQuality?.tier ? ` · 場質 ${race.raceQuality.tier}` : ""}
          </span>
        </span>
        <span className="ml-auto whitespace-nowrap text-[11px] text-ink-3">
          {top ? (
            <>
              <span className="font-semibold text-ink">{top.nameCh || top.nameEn || "—"}</span> {pct(top.pWin)}
            </>
          ) : (
            "無資料"
          )}
        </span>
        <span className={`text-[11px] text-ink-3 transition-transform ${open ? "rotate-90" : ""}`}>▶</span>
      </button>

      {open ? (
        <div className="overflow-x-auto">
          {picks.length ? (
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr>
                  <TH>排名</TH>
                  <TH>馬號</TH>
                  <TH>馬名 / 騎師 / 練馬師</TH>
                  <TH center>檔</TH>
                  <TH>馬ELO</TH>
                  <TH>騎ELO</TH>
                  <TH>練ELO</TH>
                  <TH>綜合ELO</TH>
                  <TH>因子調整</TH>
                  <TH>天喜LGB分</TH>
                  <TH>最終分</TH>
                  <TH>勝率</TH>
                  <TH>前三</TH>
                  <TH right>市場賠率</TH>
                  <TH right>市場p</TH>
                  <TH center>市場排名</TH>
                </tr>
              </thead>
              <tbody>
                {picks.map((p) => (
                  <tr key={p.horseId ?? `${p.horseNumber}`} className="border-b border-hairline last:border-0">
                    <td
                      className={`px-2 py-1.5 align-top tabnum ${
                        p.rank === 1 ? "text-[15px] font-bold text-win" : p.rank <= 3 ? "font-semibold text-gold-strong" : "text-ink-2"
                      }`}
                    >
                      {p.rank}
                    </td>
                    <td className="tabnum px-2 py-1.5 align-top text-ink">{p.horseNumber ?? "—"}</td>
                    <td className="px-2 py-1.5 align-top">
                      <div className="whitespace-nowrap text-[13px] font-semibold text-ink">{p.nameCh || p.nameEn || "—"}</div>
                      <div className="whitespace-nowrap text-[11px] text-ink-3">
                        {p.jockeyCh || "—"} / {p.trainerCh || "—"}
                      </div>
                    </td>
                    <td className="tabnum px-2 py-1.5 text-center align-top text-ink-2">{p.draw ?? "—"}</td>
                    <td className="tabnum px-2 py-1.5 align-top text-ink-2">{elo(p.horseElo)}</td>
                    <td className="tabnum px-2 py-1.5 align-top text-ink-2">{elo(p.jockeyElo)}</td>
                    <td className="tabnum px-2 py-1.5 align-top text-ink-2">{elo(p.trainerElo)}</td>
                    <td className="tabnum px-2 py-1.5 align-top font-semibold text-ink">{elo(p.eloComposite)}</td>
                    <td className="px-2 py-1.5 align-top">
                      <FactorCell bonus={p.factorBonus} breakdown={p.factorBreakdown} />
                    </td>
                    <td className="tabnum px-2 py-1.5 align-top">
                      {p.lgbScore != null ? (
                        <span className={p.lgbScore > -2.2 ? "font-semibold text-win" : "text-ink-2"}>{p.lgbScore.toFixed(2)}</span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                    <td className="tabnum px-2 py-1.5 align-top font-semibold text-ink">{elo(p.finalScore)}</td>
                    <td className={`tabnum px-2 py-1.5 align-top font-semibold ${p.rank === 1 ? "text-win" : "text-ink"}`}>
                      {pct(p.pWin)}
                    </td>
                    <td className="tabnum px-2 py-1.5 align-top text-ink-2">{pct(p.pTop3)}</td>
                    <td className="tabnum px-2 py-1.5 text-right align-top text-ink-2">
                      {p.liveWinOdds != null ? p.liveWinOdds.toFixed(1) : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="tabnum px-2 py-1.5 text-right align-top text-ink-2">
                      {p.marketProb != null ? pct(p.marketProb) : <span className="text-ink-3">—</span>}
                    </td>
                    <td className="tabnum px-2 py-1.5 text-center align-top">
                      {p.marketRank != null ? (
                        <>
                          <span className="font-semibold text-ink">{p.marketRank}</span>
                          {p.blendProb != null ? <span className="text-[10px] text-ink-3"> {pct(p.blendProb)}</span> : null}
                        </>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="px-3 py-3 text-[12px] text-ink-3">無排位資料</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function OraclePanel() {
  const load = useServerFn(getOraclePicks);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<"" | "load" | "fresh">("");

  const run = useCallback(
    (fresh: boolean) => {
      setBusy(fresh ? "fresh" : "load");
      setError(null);
      load({ data: { fresh } })
        .then(setData)
        .catch(setError)
        .finally(() => setBusy(""));
    },
    [load],
  );

  useEffect(() => {
    run(false);
  }, [run]);

  const races: any[] = data?.races ?? [];
  const anyLgb = races.some(lgbApplied);
  const allLgb = races.length > 0 && races.every(lgbApplied);
  const badge = allLgb ? "✓ 全部場已套用 天喜LGB" : anyLgb ? "◑ 部分場已套用 天喜LGB（其餘退回 天喜ELO）" : "○ 天喜LGB 未覆蓋 — 只用 天喜ELO + 因子";
  const badgeTone = allLgb ? "text-win" : anyLgb ? "text-gold-strong" : "text-ink-3";

  return (
    <div>
      <div className="mb-3 rounded-[8px] border border-hairline bg-paper-2 p-3">
        <div className="text-[13px] font-semibold text-ink">
          即日 天喜預測模型 TX-Oracle v3
          <span className="ml-2 text-[10px] font-normal tracking-wide text-ink-3">
            LIGHTGBM ENSEMBLE + 天喜ELO COMPLEMENTARY STACKING
            {races[0]?.ensembleAlpha != null ? ` · α=${races[0].ensembleAlpha}（天喜LGB 主導）` : ""}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => run(false)}
            className="rounded-[8px] bg-deep px-3 py-2 text-[12px] text-deep-fg disabled:opacity-50"
          >
            {busy === "load" ? "載入中…" : "▶ 載入即日 TX-Oracle v3 預測"}
          </button>
          <button
            type="button"
            disabled={busy !== ""}
            onClick={() => {
              if (window.confirm("將忽略快取重新運算（約 30-60 秒），確定？")) run(true);
            }}
            className="rounded-[8px] border border-hairline bg-paper px-3 py-2 text-[12px] text-ink disabled:opacity-50"
          >
            {busy === "fresh" ? "強制重算中…" : "強制重新運算"}
          </button>
        </div>

        {data ? (
          <div className="mt-2 space-y-1 text-[11px] text-ink-3">
            <div>
              <span className="tabnum text-ink">{data.date ?? "—"}</span> {data.venue ?? ""} · {races.length} 場 · 天喜ELO 引擎{" "}
              {data.eloEngine === "v12" ? "v1.2" : (data.eloEngine ?? "—")} ·{" "}
              {data.eloReady ? <span className="text-win">✓ 天喜ELO就緒</span> : <span className="text-lose">⚠ 天喜ELO未就緒</span>}
              {data.seedSummary?.totalSeeded ? ` · 新馬 seed ${data.seedSummary.totalSeeded} 隻` : ""}
            </div>
            <div>
              模型：<span className="tabnum text-ink">{data.lgbModelVersion || "(無)"}</span> ·{" "}
              {data.lgbCoverage?.rows != null ? `${data.lgbCoverage.rows} 行覆蓋` : "無覆蓋"} ·{" "}
              <span className={badgeTone}>{badge}</span>
            </div>
            <div>
              報告產生{" "}
              <span className="tabnum text-ink">
                {(data.cachedGeneratedAt || data.generatedAt || "").replace("T", " ").slice(0, 19)}
              </span>{" "}
              （{data.fromCache ? "快取" : "即時運算"}
              {data.computeMs ? ` ${data.computeMs}ms` : ""}）
            </div>
          </div>
        ) : null}
      </div>

      {busy === "load" && !data ? <Loading label="載入即日預測…" /> : null}
      {error ? <ErrorNote error={error} /> : null}
      {data && !races.length ? <Empty label="今日／下一賽日未有排位資料" /> : null}

      {races.map((r, i) => (
        <RaceCard key={r.raceNumber} race={r} defaultOpen={i < 3} />
      ))}
    </div>
  );
}
