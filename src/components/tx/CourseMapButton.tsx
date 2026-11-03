import { useQuery } from "@tanstack/react-query";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Pill } from "@/components/tx/ui";
import type { VenueWeather } from "@/routes/api/public/hkjc-weather";

type WeatherResp = { venues: VenueWeather[]; fetchedAt?: string; error?: string };
type Sectional = VenueWeather["sectional"][number];

/** 「N58E」→ 羅盤角度（度） */
function bearing(raw: string | null): number | null {
  if (!raw) return null;
  const m = /^([NS])(\d+(?:\.\d+)?)([EW])$/.exec(raw.trim());
  if (!m) return null;
  const deg = Number(m[2]);
  if (!Number.isFinite(deg)) return null;
  if (m[1] === "N") return m[3] === "E" ? deg : (360 - deg) % 360;
  return m[3] === "E" ? 180 - deg : 180 + deg;
}

const POINTS16 = [
  "北",
  "北偏東北",
  "東北",
  "東北偏東",
  "東",
  "東南偏東",
  "東南",
  "東南偏南",
  "南",
  "西南偏南",
  "西南",
  "西南偏西",
  "西",
  "西北偏西",
  "西北",
  "北偏西北",
] as const;

/** 角度 → 馬會用嘅十六方位中文名（例：西南偏西） */
function dirLabel(raw: string | null): string {
  const deg = bearing(raw);
  if (deg == null) return "—";
  return POINTS16[Math.round(deg / 22.5) % 16]!;
}

const num = (v: number | null, unit = "", digits = 1) => (v == null ? "—" : `${v.toFixed(digits)}${unit}`);

/** 風速分級色（馬會風速追蹤器：0-12 綠、13-30 淺藍、31-40 藍、41-62 橙、63+ 紅） */
function windTone(speed: number | null): string {
  if (speed == null) return "#9aa0a6";
  if (speed <= 12) return "#00a14b";
  if (speed <= 30) return "#5bc2f0";
  if (speed <= 40) return "#1c4fd8";
  if (speed <= 62) return "#f5a623";
  return "#d0021b";
}

const LEGEND = [
  { c: "#00a14b", t: "0-12" },
  { c: "#5bc2f0", t: "13-30" },
  { c: "#1c4fd8", t: "31-40" },
  { c: "#f5a623", t: "41-62" },
  { c: "#d0021b", t: "63+ 公里/小時" },
];

/** 四個風站喺圖上嘅位置（左上、右上、右下、左下），跟馬會版排位 */
const SLOTS = [
  { top: "0%", left: "22%", align: "left" as const },
  { top: "15%", left: "55%", align: "left" as const },
  { top: "55%", left: "60%", align: "left" as const },
  { top: "80%", left: "26%", align: "left" as const },
];

function trackSrc(venue: string) {
  return venue === "HV" ? "/hkjc/track_HV.svg" : "/hkjc/track_ST.svg";
}

/** 自製羅盤：整體逆時針傾斜，跟馬會官方頁面嘅羅盤擺法 */
function Compass({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={`block h-full w-full -rotate-[40deg] ${className}`} aria-hidden>
      <circle cx="50" cy="50" r="47" fill="var(--tx-paper)" stroke="var(--tx-paper)" strokeWidth="5" />
      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--tx-compass-blue)" strokeWidth="4" />
      <circle cx="50" cy="50" r="39" fill="none" stroke="var(--tx-hairline)" strokeWidth="1" />

      <g stroke="var(--tx-compass-muted)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M50 10 V17" />
        <path d="M90 50 H83" />
        <path d="M50 90 V83" />
        <path d="M10 50 H17" />
      </g>

      <g fill="var(--tx-ink-2)" fontFamily="Arial, sans-serif" fontSize="11" fontWeight="700" textAnchor="middle">
        <text x="50" y="29">N</text>
        <text x="72" y="54">E</text>
        <text x="50" y="79">S</text>
        <text x="27" y="54">W</text>
      </g>

      <path d="M50 34 L42 52 L50 48 L58 52 Z" fill="var(--tx-compass-blue)" />
      <path d="M50 70 L58 52 L50 56 L42 52 Z" fill="var(--tx-compass-muted)" />
      <circle cx="50" cy="52" r="3.5" fill="var(--tx-paper)" />
    </svg>
  );
}

/**
 * 箭嘴同馬會官方一致：方位名（例：南）＝風「吹嚟」嘅方向，
 * 箭嘴指向風「吹去」嘅方向，所以要 +180°。
 */
function arrowDeg(raw: string | null): number | null {
  const b = bearing(raw);
  return b == null ? null : (b + 180) % 360;
}

function ArrowDisc({ deg, speed, size = 26 }: { deg: number | null; speed: number | null; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: size, height: size, background: windTone(speed) }}
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" aria-hidden>
        {deg == null ? (
          <text x="12" y="17" textAnchor="middle" fontSize="14" fill="#fff">
            ?
          </text>
        ) : (
          <g transform={`rotate(${deg} 12 12)`}>
            <path d="M12 20 L12 4 M12 4 L6.5 10 M12 4 L17.5 10" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          </g>
        )}
      </svg>
    </span>
  );
}

/** 大圖：官方跑道圖 + 四個方位風向風速標籤（同馬會版一致） */
function CourseMapLarge({ w }: { w: VenueWeather }) {
  const sec = w.sectional.slice(0, 4);
  return (
    <div className="relative w-full" style={{ aspectRatio: "404 / 295" }}>
      <img
        src={trackSrc(w.venue)}
        alt={`${w.venueLabel}跑道圖`}
        className="absolute inset-0 h-full w-full object-contain"
        loading="lazy"
      />
      <div className="absolute right-1 top-1 w-[14%]">
        <Compass />
      </div>
      {sec.map((s, i) => {
        const slot = SLOTS[i]!;
        return (
          <div key={s.location + i} className="absolute flex items-start gap-1" style={{ top: slot.top, left: slot.left }}>
            <ArrowDisc deg={arrowDeg(s.direction)} speed={s.speed} />
            <div className="rounded-[6px] bg-paper/90 px-1 py-[1px] leading-tight shadow-[0_0_0_1px_rgba(0,0,0,0.04)] backdrop-blur-[1px]">
              <div className="whitespace-nowrap text-[11px] font-bold text-ink">{dirLabel(s.direction)}</div>
              <div className="tabnum whitespace-nowrap font-mono-tx text-[11px] text-ink-2">
                {num(s.speed, "", 0)} 公里/小時
              </div>
              <div className="tabnum flex items-center gap-1 whitespace-nowrap font-mono-tx text-[11px] text-ink-3">
                <img src="/hkjc/windIcon.svg" alt="陣風" className="h-[9px] w-auto opacity-70" />
                {num(s.gust, "", 0)} 公里/小時
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


/** 細圖（按鈕）：官方跑道圖 + 四個彩色風向圓點 */
function CourseMapMini({ w }: { w: VenueWeather }) {
  const sec = w.sectional.slice(0, 4);
  return (
    <div className="relative h-full w-full">
      <img src={trackSrc(w.venue)} alt="" className="absolute inset-0 h-full w-full object-contain p-[2px]" />
      {sec.map((s, i) => {
        const slot = SLOTS[i]!;
        return (
          <span key={s.location + i} className="absolute" style={{ top: slot.top, left: slot.left }}>
            <ArrowDisc deg={arrowDeg(s.direction)} speed={s.speed} size={11} />
          </span>
        );
      })}
    </div>
  );
}

/** 純場地圖縮圖（紅圈位置用）：只顯示官方跑道圖，唔疊風向箭嘴 */
function CourseMapThumb({ venue }: { venue: string }) {
  return (
    <div className="relative h-full w-full">
      <img src={trackSrc(venue)} alt="" className="absolute inset-0 h-full w-full object-contain p-[2px]" />
    </div>
  );
}

function MetricCard({ icon, label, value, unit, note }: { icon: string; label: string; value: string; unit?: string; note?: string }) {
  return (
    <div className="flex items-start justify-between gap-2 rounded-[10px] border border-hairline bg-paper px-2.5 py-2">
      <div>
        <div className="font-mono-tx text-[11px] text-ink-3">{label}</div>
        <div className="tabnum font-serif-tc text-[20px] font-bold leading-tight text-ink">
          {value}
          {unit ? <span className="ml-0.5 font-mono-tx text-[11px] font-normal text-ink-3">{unit}</span> : null}
        </div>
        {note ? <div className="font-mono-tx text-[10px] text-ink-3">{note}</div> : null}
      </div>
      <img src={icon} alt="" className="mt-0.5 h-8 w-8 shrink-0 opacity-90" loading="lazy" />
    </div>
  );
}

/**
 * 當日場地圖（馬會風速追蹤器同源，官方跑道圖）：細圖直接顯示，撳一下彈出完整場地／天氣資料。
 */
export function CourseMapButton({ venue, going }: { venue?: string | undefined; going?: string | undefined }) {
  const q = useQuery<WeatherResp>({
    queryKey: ["hkjcWeather"],
    queryFn: async () => {
      const r = await fetch("/api/public/hkjc-weather");
      if (!r.ok) throw new Error("天氣資料讀取失敗");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const list = q.data?.venues ?? [];
  const w = list.find((v) => v.venue === venue) ?? list.find((v) => v.venue !== "CH") ?? list[0];
  if (!w) {
    return (
      <div className="flex h-[58px] w-[104px] items-center justify-center rounded-[8px] border border-hairline bg-paper-3 text-[11px] text-ink-3">
        場地圖待更新
      </div>
    );
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="開啟當日場地資料"
          className="group relative h-[58px] w-[104px] shrink-0 overflow-hidden rounded-[8px] border border-hairline bg-paper-3 transition hover:border-gold-strong/50"
        >
          <CourseMapThumb venue={w.venue} />
          <span className="absolute bottom-[1px] right-[3px] font-mono-tx text-[8px] font-bold text-ink-3 group-hover:text-gold">
            場地圖 ↗
          </span>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[88vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-serif-tc">{w.venueLabel}當日場地資料</SheetTitle>
        </SheetHeader>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Pill tone="gold">場地 {going || "待公佈"}</Pill>
          <Pill tone="deep">{w.time ? `${w.time} 更新` : "即時"}</Pill>
          {w.rainToday != null && w.rainToday > 0 ? (
            <Pill tone="lose">今日雨量 {w.rainToday.toFixed(1)} 毫米</Pill>
          ) : (
            <Pill>今日無雨</Pill>
          )}
        </div>

        <div className="mt-3 rounded-[10px] border border-hairline bg-paper px-2 py-2">
          <div className="mb-1 font-serif-tc text-[13px] font-bold text-ink">風向及風速儀</div>
          <p className="mb-1 font-mono-tx text-[11px] leading-relaxed text-ink-3">
            量度騎師於競賽時在跑道指定方位上所感受嘅即時風向及風速
          </p>
          <CourseMapLarge w={w} />
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono-tx text-[11px] text-ink-3">
            {LEGEND.map((l) => (
              <span key={l.t}>
                <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: l.c }} />
                {l.t}
              </span>
            ))}
            <span className="flex items-center gap-1">
              <img src="/hkjc/windIcon.svg" alt="" className="h-[9px] w-auto opacity-70" />
              陣風
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <MetricCard icon="/hkjc/temp.svg" label="氣溫" value={num(w.temperature)} unit="°C" />
          <MetricCard icon="/hkjc/humidity.svg" label="相對濕度" value={num(w.humidity)} unit="%" />
          <MetricCard icon="/hkjc/rain.svg" label="總雨量" value={num(w.rainToday)} unit="毫米" note="自早上9時起" />
          <MetricCard icon="/hkjc/rain.svg" label="最近10分鐘雨量" value={num(w.rain10Min)} unit="毫米" />
          <MetricCard icon="/hkjc/soil.svg" label="土壤濕度" value={num(w.soilWater)} unit="%" />
          <MetricCard
            icon="/hkjc/evapotranspiration.svg"
            label="蒸散量"
            value={num(w.soilLossToday)}
            unit="毫米"
            note="自早上9時起"
          />
        </div>

        <div className="mt-3 overflow-hidden rounded-[10px] border border-hairline">
          <table className="w-full text-[11px]">
            <thead className="bg-paper-3 font-mono-tx text-[11px] text-ink-3">
              <tr>
                <th className="px-2 py-1 text-left">跑道位置</th>
                <th className="px-2 py-1 text-left">風向</th>
                <th className="px-2 py-1 text-right">風速</th>
                <th className="px-2 py-1 text-right">陣風</th>
              </tr>
            </thead>
            <tbody>
              {w.sectional.map((s: Sectional, i: number) => (
                <tr key={s.location + i} className="border-t border-hairline">
                  <td className="px-2 py-1 font-bold">{s.location}</td>
                  <td className="px-2 py-1">{dirLabel(s.direction)}</td>
                  <td className="tabnum px-2 py-1 text-right">{num(s.speed, "", 0)}</td>
                  <td className="tabnum px-2 py-1 text-right">{num(s.gust, "", 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-2 font-mono-tx text-[11px] leading-relaxed text-ink-3">
          資料來自馬會風向及風速儀（每分鐘更新），氣壓 {num(w.pressure, " hPa", 1)}、日照{" "}
          {num(w.sunshineHour, " 小時")}，僅供參考。
        </p>
      </SheetContent>
    </Sheet>
  );
}
