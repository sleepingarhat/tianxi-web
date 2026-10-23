import { useTier } from "@/lib/useTier";
import { cardAccess } from "@/lib/tier-projection";
import { useTodayPicks } from "@/lib/use-today-picks";
import { Card, Loading, Empty, Table, Td } from "../ui";
import { UpgradeCard } from "./UpgradeCard";
import { cleanTime, pct } from "@/lib/tx-api";
import type { PickRow } from "@/lib/racing-shapes";

/** Only the permitted fields are constructed as rendered rows. */
export function TieredDayCards() {
  const tier = useTier();
  const day = useTodayPicks();
  if (day.isLoading || tier.loading) return <Loading />;
  if (!day.races.length) return <Empty label="今日尚無預測" />;
  return <>{day.races.map(r => {
    const access = cardAccess(tier.tier, Number(r.raceNumber));
    return <Card key={r.raceNumber} title={`第 ${r.raceNumber} 場預測`} en={cleanTime(r.startTime) || "Race Picks"}>
      {access === "full" ? <Table head={["馬匹", "勝算", "前三", "前四"]}>{(r.picks ?? []).slice(0, 6).map((p: PickRow) => <tr key={p.horseNumber}><Td first>{p.horseNumber} {p.nameCh}</Td><Td>{pct(p.pWin)}</Td><Td>{pct(p.pTop3)}</Td><Td>{pct(p.pTop4)}</Td></tr>)}</Table> : access === "name" ? <p className="font-bold text-ink">{r.picks?.[0]?.nameCh || "首選待定"}</p> : null}
      {access !== "full" ? <UpgradeCard inline need={access === "name" ? "pro" : "registered"} feature={access === "name" ? "全日逐場預測" : "其他場次首選"} /> : null}
    </Card>;
  })}</>;
}