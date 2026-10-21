import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { Card, Disclaimer, Empty, ErrorNote, Loading, PageHead, Pill, Table, Td } from "@/components/tx/ui";
import { fmtMeetingDate, txApi } from "@/lib/tx-api";

export const Route = createFileRoute("/pool-odds")({
  head: () => ({
    meta: [
      { title: "彩池賠率 · 天喜 TIANXI" },
      { name: "description", content: "逐場獨贏賠率排序、市場熱門與冷門對照，配合引擎勝算尋找價值。" },
      { property: "og:title", content: "彩池賠率 · 天喜 TIANXI" },
      { property: "og:description", content: "逐場賠率排序與市場熱度。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PoolOddsPage,
});

function PoolOddsPage() {
  const [raceNo, setRaceNo] = useState(1);
  const smart = useQuery({ queryKey: ["smartCurrent"], queryFn: () => txApi.smartCurrent() });
  const date = smart.data?.date;
  const meeting = useQuery({
    queryKey: ["meeting", date],
    queryFn: () => {
      if (!date) throw new Error('未有賽日日期');
      return txApi.meeting(date);
    },
    enabled: !!date,
    refetchInterval: 60_000,
  });

  const races = meeting.data?.races || [];
  const race = races.find((r) => Number(r.raceNumber) === raceNo) || races[0];
  const horses = [...(race?.horses || [])].sort(
    (a, b) => (a.winOdds ?? 999) - (b.winOdds ?? 999),
  );

  return (
    <AppShell
      page="predictor"
      ticker={smart.data ? `${fmtMeetingDate(smart.data.date)} · ${smart.data.venueName} · 賠率排序` : "載入中…"}
    >
      <PageHead en="Pool Odds" title="彩池賠率" desc="以獨贏賠率由熱至冷排序，快速看出市場焦點與被忽略的馬匹。" />

      <div className="no-scrollbar mx-4 mb-1 flex gap-1 overflow-x-auto">
        {races.map((r) => {
          const on = Number(r.raceNumber) === raceNo;
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setRaceNo(Number(r.raceNumber))}
              className={`tabnum shrink-0 rounded-[4px] border px-2.5 py-1 font-mono-tx text-[11px] font-bold ${
                on ? "border-gold-strong bg-gold-bg text-gold" : "border-hairline bg-paper text-ink-2"
              }`}
            >
              R{r.raceNumber}
            </button>
          );
        })}
      </div>

      <Card
        title={race ? `第 ${race.raceNumber} 場 賠率` : "賠率"}
        en="Win Odds"
        action={
          race ? (
            <Link to="/race" search={{ id: race.id }} className="text-[11px] font-bold text-gold">
              排位表 →
            </Link>
          ) : null
        }
      >
        {meeting.isLoading ? (
          <Loading />
        ) : meeting.error ? (
          <ErrorNote error={meeting.error} />
        ) : horses.length ? (
          <Table head={["馬匹", "檔", "負磅", "賠率", "熱度"]}>
            {horses.map((h, i) => (
              <tr key={h.id} className={`border-b border-hairline ${i === 0 ? "bg-gold-bg/50" : ""}`}>
                <Td first>
                  <span className="tabnum mr-1.5 inline-block w-6 rounded-[4px] bg-deep px-1 py-0.5 text-center font-mono-tx text-[11px] font-bold text-deep-fg">
                    {h.horseNumber}
                  </span>
                  <span className="font-serif-tc text-[12px] font-bold">{h.nameCh || h.name}</span>
                </Td>
                <Td>{h.draw ?? "—"}</Td>
                <Td>{h.weight ?? h.declaredWeight ?? "—"}</Td>
                <Td className="font-bold">{h.winOdds ?? "—"}</Td>
                <Td>
                  {i === 0 ? <Pill tone="win">大熱</Pill> : i < 3 ? <Pill tone="gold">熱門</Pill> : i >= horses.length - 3 ? <Pill tone="lose">冷門</Pill> : "—"}
                </Td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty label="此場尚無賠率" />
        )}
      </Card>

      <Disclaimer extra="網站每分鐘重新讀取已保存盤口，並非保證馬會賠率每分鐘更新；最終賠率以馬會為準。" />
    </AppShell>
  );
}
