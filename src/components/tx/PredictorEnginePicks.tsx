import { Link } from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Empty, ErrorNote, Loading, Pill, Scroller, Silks, Table, Td } from "@/components/tx/ui";
import { pct } from "@/lib/tx-api";
import { racingClassLabel } from "@/lib/racing-class";
import type { useTodayPicks } from "@/lib/use-today-picks";
import type { effectiveTop4 } from "@/lib/withdrawal-substitution";

type TodayPicks = ReturnType<typeof useTodayPicks>;
/** Read-only table and retry control; no data fetching or score changes. */
export function PredictorEnginePicks({ race, invalidInput, tp, start, sub, liveOdds }: {
  race: TodayPicks['races'][number] | undefined;
  invalidInput: boolean;
  tp: Pick<TodayPicks, 'isLoading' | 'error' | 'isFetching' | 'refetch'>;
  start: string | null;
  sub: ReturnType<typeof effectiveTop4>;
  liveOdds: (n: unknown) => number | null;
}) {
  return (
      <Card
        title={race ? `第 ${race.raceNumber} 場 ${invalidInput ? "原凍結事故紀錄（非有效預測）" : "引擎首選"}` : "引擎首選"}
        en="Engine Picks"
        action={
          race?.raceId ? (
            <Link to="/race" search={{ id: race.raceId }} className="text-[11px] font-bold text-gold">
              排位表 →
            </Link>
          ) : null
        }
      >
        {tp.isLoading ? (
          <Loading />
        ) : tp.error ? (
          <div role="alert" className="space-y-3">
            <ErrorNote error={new Error(/timeout|timed out|aborted/i.test(String(tp.error)) ? "讀取預測逾時，暫停展示四揀；請重新核對。" : "預測暫未能核實，暫停展示四揀；請重新核對。")} />
            <Button variant="outline" onClick={() => void tp.refetch()} disabled={tp.isFetching}>
              <RefreshCw className={tp.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />
              {tp.isFetching ? "重新核對中…" : "重新核對"}
            </Button>
          </div>
        ) : race ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">

              <Pill tone="gold">{race.distance}m</Pill>
              <Pill>{race.going || "—"}</Pill>
              <Pill>{racingClassLabel(race.class)}</Pill>
              <Pill tone={race.scoreSource === "lgb" ? "win" : "ink"}>
                {race.scoreSource === "lgb" ? "天喜LGB 模型" : "基準模型"}
              </Pill>
              {race.raceQuality?.tier ? <Pill>賽事質素 {race.raceQuality.tier}</Pill> : null}
              {start ? <Pill>{start}</Pill> : null}
            </div>
            <Scroller>
              <Table head={["馬匹", "檔", "負磅", "勝算", "前三", "前四", "賠率"]}>
                {(race.picks || []).map((p: any, i: number) => {
                  return (
                    <tr key={p.horseNumber} className={`border-b border-hairline ${i === 0 ? "bg-gold-bg/50" : ""}`}>
                      <Td first>
                        <div className="flex items-center gap-1.5">
                          <Silks source={p} size={34} className="shadow-sm" />
                          <span className="tabnum grid h-7 w-7 shrink-0 place-items-center rounded-[4px] bg-deep font-mono-tx text-[12px] font-bold text-deep-fg">
                            {p.horseNumber}
                          </span>
                          {p.horseId ? (
                            <Link to="/horse" search={{ id: p.horseId }} className="font-serif-tc text-[14px] font-bold">
                              {p.nameCh}
                            </Link>
                          ) : (
                            <span className="font-serif-tc text-[14px] font-bold">{p.nameCh}</span>
                          )}
                        </div>
                        {p.officialChange ? <p className="mt-1 text-[10px] font-bold text-lose">已退出 · 馬會 {p.officialChange.announcedAt} 公布</p> : null}
                        <p className="mt-0.5 text-[10px] text-ink-3">
                          {p.jockeyCh || "—"} / {p.trainerCh || "—"}
                        </p>
                      </Td>
                      <Td>{p.draw ?? "—"}</Td>
                      <Td>{p.weight ?? p.declaredWeight ?? "—"}</Td>
                      <Td>{pct(p.pWin)}</Td>
                      <Td>{pct(p.pTop3)}</Td>
                      <Td>{pct(p.pTop4)}</Td>
                      <Td>{p.officialChange ? "已退出" : liveOdds(p.horseNumber) ?? p.winOdds ?? "—"}</Td>
                    </tr>
                  );
                })}
              </Table>
            </Scroller>
            {race.expectedBoxCoverage ? (
              <p className="tabnum font-mono-tx text-[10px] leading-relaxed text-ink-3">
                期望覆蓋率 · 三重彩 N4 {pct(race.expectedBoxCoverage.trio_n4)} / N5 {pct(race.expectedBoxCoverage.trio_n5)} /
                N6 {pct(race.expectedBoxCoverage.trio_n6)} · 四重彩 N6 {pct(race.expectedBoxCoverage.first4_n6)}
              </p>
            ) : null}
          </div>
        ) : (
          <Empty label="今日尚無預測" />
        )}
      </Card>

  );
}
