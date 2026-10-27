import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Card, Empty, Loading, Pill, Stat, StatGrid } from "@/components/tx/ui";
import { MeterBar } from "@/components/tx/viz";
import type { VenueWeather } from "@/routes/api/public/hkjc-weather";

type WeatherResp = { venues: VenueWeather[]; fetchedAt?: string; error?: string };

/** 「N58E」→「北偏東 58°」 */
function dirLabel(raw: string | null): string {
  if (!raw) return "—";
  const m = /^([NS])(\d+)([EW])$/.exec(raw.trim());
  if (!m) return raw;
  const base = m[1] === "N" ? "北" : "南";
  const side = m[3] === "E" ? "東" : "西";
  return `${base}偏${side} ${m[2]}°`;
}

const num = (v: number | null, unit = "", digits = 0) =>
  v == null ? "—" : `${v.toFixed(digits)}${unit}`;

/** 馬會馬場即時天氣（同「風速追蹤器」同源），每 60 秒更新。 */
export function WeatherPanel({ venue }: { venue?: string | undefined }) {
  const q = useQuery<WeatherResp>({
    queryKey: ["hkjcWeather"],
    queryFn: async () => {
      const r = await fetch("/api/public/hkjc-weather");
      if (!r.ok) throw new Error("天氣資料讀取失敗");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const venues = (q.data?.venues ?? []).filter((v) => (venue ? v.venue === venue : true));
  const [pick, setPick] = useState<string | null>(null);
  const cur = venues.find((v) => v.venue === pick) ?? venues[0];

  return (
    <Card
      title="馬場即時天氣"
      en="Live Weather"
      action={
        venues.length > 1 ? (
          <div className="flex gap-1">
            {venues.map((v) => (
              <button
                key={v.venue}
                type="button"
                onClick={() => setPick(v.venue)}
                className={
                  v.venue === cur?.venue
                    ? "rounded-[4px] border border-gold-strong/40 bg-gold-bg px-2 py-[3px] text-[10px] font-bold text-gold"
                    : "rounded-[4px] border border-hairline bg-paper px-2 py-[3px] text-[10px] font-bold text-ink-3"
                }
              >
                {v.venueLabel}
              </button>
            ))}
          </div>
        ) : null
      }
    >
      {q.isLoading ? (
        <Loading label="讀取馬會天氣站…" />
      ) : !cur ? (
        <Empty label="馬會天氣站暫無資料" />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            <Pill tone="deep">{cur.venueLabel}</Pill>
            <Pill tone="gold">{cur.time ? `${cur.time} 更新` : "即時"}</Pill>
            {cur.rainToday != null && cur.rainToday > 0 ? (
              <Pill tone="lose">今日雨量 {cur.rainToday.toFixed(1)} 毫米</Pill>
            ) : (
              <Pill>今日無雨</Pill>
            )}
          </div>

          <StatGrid cols={3}>
            <Stat
              label="氣溫"
              value={num(cur.temperature, "°", 1)}
              sub={`高 ${num(cur.temperatureMax, "°", 1)} / 低 ${num(cur.temperatureMin, "°", 1)}`}
            />
            <Stat label="相對濕度" value={num(cur.humidity, "%")} sub={`氣壓 ${num(cur.pressure, "hPa", 1)}`} />
            <Stat
              label="平均風"
              value={num(cur.windSpeed, " km/h")}
              sub={`${dirLabel(cur.windDirection)} · 陣風 ${num(cur.gustSpeed, "")}`}
            />
            <Stat label="10 分鐘雨量" value={num(cur.rain10Min, "mm", 1)} />
            <Stat label="草地含水量" value={num(cur.soilWater, "%", 1)} sub={`蒸散 ${num(cur.soilLossToday, "mm", 1)}`} />
            <Stat label="日照時數" value={num(cur.sunshineHour, "h", 1)} />
          </StatGrid>

          {cur.sectional.length > 0 && (
            <div className="mt-3 border-t border-hairline pt-2">
              <p className="mb-1.5 text-[10px] font-medium text-ink-3">跑道各段風速（km/h）</p>
              <div className="space-y-1.5">
                {cur.sectional.map((s) => (
                  <MeterBar
                    key={s.location}
                    label={`${s.location} 段 · ${dirLabel(s.direction)}`}
                    value={`${num(s.speed)} / 陣風 ${num(s.gust)}`}
                    ratio={Math.min((s.speed ?? 0) / 40, 1)}
                  />
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 text-[9px] leading-relaxed text-ink-3">
            資料源：香港賽馬會馬場天氣站（風速追蹤器），每分鐘更新，僅供參考。
          </p>
        </>
      )}
    </Card>
  );
}
