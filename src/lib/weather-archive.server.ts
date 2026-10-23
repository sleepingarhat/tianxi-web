type VenueWeather = import("@/routes/api/public/hkjc-weather").VenueWeather;

/** 香港時間（UTC+8）當下 */
function hkNow() {
  return new Date(Date.now() + 8 * 3600 * 1000);
}
function hkDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

/**
 * 只喺賽馬日、首場開跑前 3 小時至尾場後 1 小時之間先存檔。
 * 回傳 null = 應該存檔；回傳字串 = 略過原因。
 */
async function outOfWindow(): Promise<string | null> {
  const now = hkNow();
  const date = hkDateStr(now);
  let races: Array<{ startTime?: string | null }> = [];
  try {
    const r = await fetch(
      `https://tianxi-backend.tianxi-entertainment.workers.dev/api/meetings/${date}`,
      { credentials: "omit" },
    );
    if (!r.ok) return `無賽事（${date}）`;
    const j = (await r.json()) as { races?: Array<{ startTime?: string | null }> };
    races = j.races ?? [];
  } catch {
    return "賽事資料暫時讀取唔到";
  }
  const mins = races
    .map((x) => /^(\d{1,2}):(\d{2})/.exec(String(x.startTime ?? "")))
    .flatMap((match) => match ? [Number(match[1]) * 60 + Number(match[2])] : []);
  if (mins.length === 0) return `無開跑時間（${date}）`;
  const nowMin = now.getUTCHours() * 60 + now.getUTCMinutes();
  const first = Math.min(...mins);
  const last = Math.max(...mins);
  if (nowMin < first - 180) return "未到首場前 3 小時";
  if (nowMin > last + 60) return "賽事已完結";
  return null;
}

async function loadVenues(origin: string): Promise<VenueWeather[]> {
  const r = await fetch(`${origin}/api/public/hkjc-weather`);
  if (!r.ok) return [];
  const j = (await r.json()) as { venues?: VenueWeather[] };
  return j.venues ?? [];
}

/** Shared work; callers must authenticate before entry. */
export async function runWeatherArchive(origin: string, force = false): Promise<Response> {
        if (!force) {
          const skip = await outOfWindow();
          if (skip) return Response.json({ ok: true, saved: 0, skipped: skip });
        }
        const venues = await loadVenues(origin);
        if (venues.length === 0) {
          return Response.json({ ok: false, saved: 0, error: "天氣源暫無資料" });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const rows = venues.map((v) => ({
          venue: v.venue,
          station_time: v.time,
          temperature: v.temperature,
          temperature_max: v.temperatureMax,
          temperature_min: v.temperatureMin,
          humidity: v.humidity,
          pressure: v.pressure,
          wind_direction: v.windDirection,
          wind_speed: v.windSpeed,
          gust_speed: v.gustSpeed,
          rain_10min: v.rain10Min,
          rain_today: v.rainToday,
          soil_water: v.soilWater,
          soil_loss_today: v.soilLossToday,
          sunshine_hour: v.sunshineHour,
          sectional: v.sectional,
        }));
        const { error } = await supabaseAdmin.from("weather_snapshots").insert(rows);
        if (error) return Response.json({ ok: false, saved: 0, error: error.message }, { status: 500 });
        return Response.json({ ok: true, saved: rows.length });
}
