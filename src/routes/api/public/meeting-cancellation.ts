import { createFileRoute } from "@tanstack/react-router";

// 停賽自動偵測：人手覆寫 → 官方公告關鍵字 → 賽日結構（疑似）。
// 只回狀態，唔生成、唔鎖定、唔改凍結預測。
const WORKER_BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev";
const DB_RAW =
  "https://raw.githubusercontent.com/sleepingarhat/tianxi-racing/main/data/meeting-status";
const HKJC_PAGES = [
  "https://racing.hkjc.com/racing/information/Chinese/Racing/RaceCard.aspx",
  "https://racing.hkjc.com/racing/information/Chinese/Racing/LocalResults.aspx",
];

const CANCEL_KEYWORDS = [
  "賽事取消",
  "取消賽事",
  "賽馬取消",
  "停賽",
  "賽事暫停",
  "賽事延期",
  "改期舉行",
  "meeting cancelled",
  "meeting abandoned",
  "racing cancelled",
  "abandoned",
];

export type MeetingStatus = {
  date: string;
  status: "racing" | "cancelled" | "suspected";
  label: string;
  reason: string;
  source: "override" | "official" | "structure" | "none" | "unknown";
  detectedAt: string;
};

function hkToday(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : "";
}

async function fetchText(url: string, ms = 6000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** 1. 人手覆寫（tianxi-racing data/meeting-status/YYYY-MM-DD.json） */
async function readOverride(date: string): Promise<MeetingStatus | null> {
  const text = await fetchText(`${DB_RAW}/${date}.json`);
  if (!text) return null;
  try {
    const j = JSON.parse(text) as {
      status?: string;
      reason_zh_hk?: string;
      label_zh_hk?: string;
      recorded_at?: string;
    };
    if (String(j.status || "").toLowerCase() !== "cancelled") return null;
    return {
      date,
      status: "cancelled",
      label: j.label_zh_hk || "今日賽事停賽",
      reason: j.reason_zh_hk || "馬會公布今日賽事停賽；不會生成或鎖定預測，亦不會計入戰績。",
      source: "override",
      detectedAt: j.recorded_at || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function matchedSentence(html: string): { hit: string; sentence: string } | null {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const lower = text.toLowerCase();
  for (const kw of CANCEL_KEYWORDS) {
    const idx = lower.indexOf(kw.toLowerCase());
    if (idx === -1) continue;
    return { hit: kw, sentence: text.slice(Math.max(0, idx - 60), idx + 90).trim() };
  }
  return null;
}

/** 2. 官方公告關鍵字；命中時即時保存原文＋SHA-256 證據（append-only）。 */
async function readOfficial(date: string): Promise<MeetingStatus | null> {
  const compact = date.replace(/-/g, "/");
  for (const base of HKJC_PAGES) {
    const sourceUrl = `${base}?RaceDate=${encodeURIComponent(compact)}`;
    const html = await fetchText(sourceUrl);
    if (!html) continue;
    const m = matchedSentence(html);
    if (!m) continue;
    // 證據存檔失敗唔會隱瞞停賽狀態，但會發通知，等稽核可以追查缺口。
    const { archiveCancellationEvidence } = await import(
      "@/lib/hkjc-cancellation-evidence.server"
    );
    const archived = await archiveCancellationEvidence({
      date,
      sourceUrl,
      keyword: m.hit,
      sentence: m.sentence,
      rawHtml: html,
    }).catch(() => ({ ok: false as const, error: "archive-threw" }));
    if (!archived.ok) {
      const { sendTelegramAlert } = await import("@/lib/telegramAlert.server");
      await sendTelegramAlert(
        `⚠️ 停賽偵測：${date} 官方公告命中「${m.hit}」，但原文存檔失敗（${archived.error}）；停賽狀態仍生效，證據缺口要人手跟進。`,
      ).catch(() => null);
    }
    return {
      date,
      status: "cancelled",
      label: "今日賽事停賽",
      reason: `馬會公告：${m.sentence}（關鍵字「${m.hit}」）。不會生成或鎖定預測，亦不會計入戰績。`,
      source: "official",
      detectedAt: new Date().toISOString(),
    };
  }
  return null;
}

/** 3. 賽日結構：日曆有賽日但排位表空 → 疑似停賽（只查當日／過往，未來日排位表未出屬正常） */
async function readStructure(date: string): Promise<MeetingStatus | null> {
  if (date > hkToday()) return null;
  const listText = await fetchText(
    `${WORKER_BASE}/api/meetings?month=${encodeURIComponent(date.slice(0, 7))}&limit=100`,
  );
  if (!listText) return null;
  let hasFixture = false;
  try {
    const list = JSON.parse(listText) as { meetings?: { date: string }[] };
    hasFixture = (list.meetings || []).some((m) => String(m.date).slice(0, 10) === date);
  } catch {
    return null;
  }
  if (!hasFixture) return null;

  const detailText = await fetchText(`${WORKER_BASE}/api/meetings/${encodeURIComponent(date)}`);
  if (!detailText) return null;
  try {
    const detail = JSON.parse(detailText) as {
      totalRaces?: number;
      races?: { horses?: unknown[] }[];
    };
    const races = detail.races || [];
    const runners = races.reduce((sum, r) => sum + (r.horses?.length || 0), 0);
    if (races.length > 0 && runners > 0) return null;
    return {
      date,
      status: "suspected",
      label: "疑似停賽（待馬會確認）",
      reason: "日曆有賽日，但排位表無場次／無出賽馬匹。暫不生成或鎖定預測，亦不計入戰績；待馬會公布再確認。",
      source: "structure",
      detectedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/api/public/meeting-cancellation")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const raw = url.searchParams.get("date") || "";
        const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : hkToday();

        const json = (body: MeetingStatus, maxAge = 60) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Cache-Control": `public, max-age=${maxAge}, s-maxage=${maxAge * 2}`,
            },
          });

        try {
          const override = await readOverride(date);
          if (override) return json(override, 300);

          const official = await readOfficial(date);
          if (official) return json(official);

          const structure = await readStructure(date);
          if (structure) return json(structure);

          return json({
            date,
            status: "racing",
            label: "正常賽日",
            reason: "",
            source: "none",
            detectedAt: new Date().toISOString(),
          });
        } catch (err) {
          // 抓唔到上游 → 守舊：當正常賽日，唔誤報停賽。
          return json(
            {
              date,
              status: "racing",
              label: "正常賽日",
              reason: `停賽偵測上游暫時無法讀取：${String(err)}`,
              source: "unknown",
              detectedAt: new Date().toISOString(),
            },
            30,
          );
        }
      },
    },
  },
});
