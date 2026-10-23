/** Shared work; callers must authenticate before entry. */
const REPO_OWNER = "sleepingarhat";
const REPO_NAME = "tianxi-racing";
const GH = "https://api.github.com";

const COLS = [
  "venue",
  "station_time",
  "temperature",
  "temperature_max",
  "temperature_min",
  "humidity",
  "pressure",
  "wind_direction",
  "wind_speed",
  "gust_speed",
  "rain_10min",
  "rain_today",
  "soil_water",
  "soil_loss_today",
  "sunshine_hour",
  "captured_at",
  "sectional",
] as const;

export function hkDateStr(offsetDays = 0) {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function ghHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "User-Agent": "tianxi-web",
    "Content-Type": "application/json",
  };
}

export async function syncWeatherDate(date: string) {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) return { ok: false, error: "未設定 GitHub token" };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("weather_snapshots")
    .select(COLS.join(","))
    .gte("captured_at", `${date}T00:00:00+08:00`)
    .lt("captured_at", `${date}T23:59:59.999+08:00`)
    .order("captured_at", { ascending: true });
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  if (rows.length === 0) return { ok: true, date, rows: 0, skipped: "當日無天氣存檔" };

  const path = `data/weather/${date.slice(0, 7)}.csv`;
  const meta = await fetch(
    `${GH}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`,
    { headers: ghHeaders(token) },
  );
  let existing = "";
  let sha: string | undefined;
  if (meta.ok) {
    const j = (await meta.json()) as { content?: string; sha?: string };
    sha = j.sha;
    existing = j.content ? Buffer.from(j.content, "base64").toString("utf8") : "";
  } else if (meta.status !== 404) {
    return { ok: false, error: `GitHub 讀取失敗 [${meta.status}]: ${await meta.text()}` };
  }

  // 同日重跑：先移除當日舊行，避免重複
  const header = COLS.join(",");
  const kept = existing
    .split("\n")
    .filter((l) => l.trim() && l !== header && !l.includes(`${date}T`));
  const added = rows.map((r) => COLS.map((c) => csvCell(r[c])).join(","));
  const body = [header, ...kept, ...added].join("\n") + "\n";

  const put = await fetch(`${GH}/repos/${REPO_OWNER}/${REPO_NAME}/contents/${path}`, {
    method: "PUT",
    headers: ghHeaders(token),
    body: JSON.stringify({
      message: `chore(weather): sync ${date} track weather snapshots (${rows.length} rows)`,
      content: Buffer.from(body, "utf8").toString("base64"),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!put.ok) {
    const t = await put.text();
    console.error(`weather-sync-github failed [${put.status}]: ${t}`);
    return { ok: false, error: `GitHub 寫入失敗 [${put.status}]: ${t}` };
  }
  return { ok: true, date, rows: rows.length, path };
}

