import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { AppShell } from "@/components/tx/AppShell";
import { CoverageAudit } from "@/components/tx/CoverageAudit";
import { ModelVersions } from "@/components/tx/ModelVersions";
import { EngineValueCompare } from "@/components/tx/EngineValueCompare";
import { OfficialRaceAudit } from '@/components/tx/OfficialRaceAudit';
import {
  Card,
  Disclaimer,
  Empty,
  ErrorNote,
  Loading,
  PageHead,
  Pill,
  Scroller,
  Seg,
  Table,
  Td,
} from "@/components/tx/ui";
import { HitStrip, KpiTile, KV, Spark } from "@/components/tx/viz";
import { fmtMeetingDate, num, txApi } from "@/lib/tx-api";
import { useAuthState } from '@/lib/useAuthState';
import { Button } from '@/components/ui/button';

export function TrackRecordDetails({ rollup }: { rollup: any }) {
  const { signedIn } = useAuthState();
  const days = rollup.windowDays;
  const roll = { data: rollup, isLoading: false, error: null };
  const s = roll.data?.summary || roll.data;
  const meetings: any[] = (roll.data?.perMeeting || roll.data?.meetings || roll.data?.byMeeting || [])
    .slice()
    .sort((a: any, b: any) => (a.date < b.date ? 1 : -1));
  const chrono = meetings.slice().reverse();
  const trend = chrono.map((m: any) => m.top4AvgIntersect);
  const hits = chrono.map((m: any) => (m.top4AvgIntersect == null ? null : m.top4AvgIntersect >= 3));

  return (
    <>
      <EngineValueCompare />
      <OfficialRaceAudit meetings={meetings} />
      <ModelVersions engine="racing" />
      <CoverageAudit days={days} />
      <Card title={`滾動統計 · 近 ${days} 日`} en="Rollup">
        {roll.isLoading ? (
          <Loading />
        ) : roll.error ? (
          <ErrorNote error={roll.error} />
        ) : (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <KpiTile
                label="四揀平均中"
                en="Top4 Avg"
                value={num(s?.top4AvgIntersect, 2)}
                unit="／4"
                ratio={s?.top4AvgIntersect != null ? Number(s.top4AvgIntersect) / 4 : null}
                tone={Number(s?.top4AvgIntersect) >= 3 ? "win" : "gold"}
                sub={`目標 3.00 · ${s?.racesEvaluated ?? 0} 場 / ${s?.meetingsEvaluated ?? 0} 日`}
                trend={trend}
                target={3}
              />
              <KpiTile
                label="前三平均中"
                en="Top3 Avg"
                value={num(s?.top3AvgIntersect, 2)}
                unit="／3"
                ratio={s?.top3AvgIntersect != null ? Number(s.top3AvgIntersect) / 3 : null}
                sub={`三甲任中 ${num(s?.top3AnyHitRate) + "%"}`}
                trend={chrono.map((m: any) => m.top3AvgIntersect)}
              />
            </div>
            <div className="rounded-[10px] border border-hairline bg-paper p-2.5">
              <p className="mb-1 text-[10px] font-bold text-ink-3">四揀平均中匹數走勢（虛線＝目標 3）</p>
              <Spark values={trend} height={46} tone={Number(s?.top4AvgIntersect) >= 3 ? "win" : "gold"} />
              <p className="mb-1.5 mt-2 text-[10px] font-bold text-ink-3">逐日達標</p>
              <HitStrip hits={hits} max={40} />
            </div>
            <div className="rounded-[10px] border border-hairline bg-paper px-2.5 py-1.5">
              <KV k="位置Q（頭兩名不計次序）" v={`${num(s?.qpHitRate) + "%"} · ${s?.qpHits ?? 0} 次`} />
              <KV k="連贏（頭兩名順序）" v={num(s?.quinellaHitRate) + "%"} />
              <KV k="三重彩（頭三名複式）" v={`${num(s?.trioHitRate) + "%"} · ${s?.trioHits ?? 0} 次`} />
              <KV k="四重彩（頭四名複式）" v={`${num(s?.first4HitRate) + "%"} · ${s?.first4Hits ?? 0} 次`} />
            </div>
          </div>
        )}
      </Card>

      <Card
        title="逐賽日對賬"
        en="By Meeting"
        action={
          <Link to="/freeze-ledger" className="font-mono-tx text-[10px] font-bold text-gold">
            凍結對帳表 →
          </Link>
        }
      >
        {roll.isLoading ? (
          <Loading />
        ) : meetings.length ? (
          <Scroller><Table head={["賽日", "場", "四揀中", "前三", "三甲", "位置Q", "三重彩", "四重彩"]}>
            {meetings.map((m: any) => (
              <tr key={`${m.date}-${m.venue}`} className={`border-b border-hairline ${(m.top4AvgIntersect ?? 0) >= 3 ? "bg-win/5" : ""}`}>
                <Td first>
                  <Link to="/results" search={{ date: m.date }} className="font-serif-tc text-[12px] font-bold">
                    {fmtMeetingDate(m.date)}
                  </Link>
                  <span className="ml-1 font-mono-tx text-[9px] text-ink-3">{m.venue === "HV" ? "跑馬地" : "沙田"}</span>
                </Td>
                <Td>{m.racesEvaluated ?? m.races ?? "—"}</Td>
                <Td className={(m.top4AvgIntersect ?? 0) >= 3 ? "font-bold text-win" : "font-bold"}>
                  {num(m.top4AvgIntersect, 2)}
                </Td>
                <Td>{num(m.top3AvgIntersect, 2)}</Td>
                <Td>{num(m.top3AnyHitRate) + "%"}</Td>
                <Td>{num(m.qpHitRate) + "%"}</Td>
                <Td>{num(m.trioHitRate) + "%"}</Td>
                <Td>{num(m.first4HitRate) + "%"}</Td>
              </tr>
            ))}
          </Table></Scroller>
        ) : (
          <Empty label="此窗口暫無已完場賽日" />
        )}
      </Card>

      {signedIn === false ? <Card title="睇完成績，免費用全站功能" en="Upgrade">
        <p className="mb-2 text-[12px] text-ink-2">
          免費對賬永久公開。想要賽前全卡預測、模型搏冷 + 市場穩陣雙欄、pWin 信心分？而家限時免費，權益等同 Pro，冇隱藏收費。
        </p>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="border-gold-strong/60 bg-gold-bg text-gold">
            <Link to="/auth" search={{ mode: 'signup' }}>免費註冊 →</Link>
          </Button>
          <Pill tone="gold">限時免費 · 收費未開放</Pill>
        </div>
      </Card> : null}

      <Disclaimer extra="戰績只對最終版凍結四揀，「三重彩」＝以模型首三匹打複式，實際頭三名全中即算命中；「四重彩」＝以模型首四匹打複式，實際頭四名全中即算命中。主指標為四揀平均命中匹數。" />
    </>
  );
}
