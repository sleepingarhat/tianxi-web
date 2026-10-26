import { JOB_TICK_WATCHES, parseJobTick } from "./job-ticks";
import type { WorkflowState } from "./racingOps.functions";
const GH = "https://api.github.com/repos/sleepingarhat/tianxi-racing";

function gh(path: string) {
  const token = process.env["GITHUB_TOKEN"];
  return fetch(`${GH}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "tianxi-web",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
}

const WORKFLOWS: { file: string; label: string; staleH: number }[] = [
  { file: "capy_race_daily.yml", label: "每日賽果＋派彩收料", staleH: 30 },
  { file: "capy_d1_sync.yml", label: "賽果同步入數據庫", staleH: 30 },
  { file: "capy_entries.yml", label: "排位表收料", staleH: 72 },
  { file: "capy_odds.yml", label: "賠率收料", staleH: 72 },
  { file: "backend_engine_sanity_daily.yml", label: "引擎每日健康檢查", staleH: 30 },
  { file: "backend_lgb_predict_upcoming.yml", label: "下一賽日預測", staleH: 96 },
  { file: "elo-post-race.yml", label: "賽後 Elo 更新", staleH: 120 },
  { file: "automation_watchdog.yml", label: "自動化看門狗", staleH: 30 },
];

export async function readRacingHealth() {
  const year = new Date().getUTCFullYear();
  // 1. 最後一次派彩收料
  let lastDividend: { date: string; committedAt: string | null } | null = null;
  try {
    const res = await gh(`/contents/data/${year}`);
    if (res.ok) {
      const list = (await res.json()) as { name: string; path: string }[];
      const div = list.filter((f) => /^dividends_\d{4}-\d{2}-\d{2}\.csv$/.test(f.name)).sort((a, b) => (a.name < b.name ? 1 : -1))[0];
      if (div) {
        const c = await gh(`/commits?path=${encodeURIComponent(div.path)}&per_page=1`);
        const cj = c.ok ? ((await c.json()) as { commit?: { committer?: { date?: string } } }[]) : [];
        lastDividend = { date: div.name.slice(10, 20), committedAt: cj[0]?.commit?.committer?.date ?? null };
      }
    }
  } catch {
    /* 留空 */
  }

  // 2. 定時任務
  const workflows: WorkflowState[] = await Promise.all(
    WORKFLOWS.map(async (w) => {
      try {
        const res = await gh(`/actions/workflows/${w.file}/runs?per_page=1`);
        if (!res.ok) return { ...w, status: "unknown", conclusion: null, startedAt: null, ageHours: null, state: "unknown" as const };
        const j = (await res.json()) as { workflow_runs?: { status: string; conclusion: string | null; run_started_at?: string; created_at: string }[] };
        const r = j.workflow_runs?.[0];
        if (!r) return { ...w, status: "never", conclusion: null, startedAt: null, ageHours: null, state: "warn" as const };
        const startedAt = r.run_started_at ?? r.created_at;
        const ageHours = (Date.now() - Date.parse(startedAt)) / 3600_000;
        let state: WorkflowState["state"] = "ok";
        if (r.status === "completed" && r.conclusion && !["success", "skipped"].includes(r.conclusion)) state = "fail";
        else if (ageHours > w.staleH) state = "warn";
        return { label: w.label, file: w.file, status: r.status, conclusion: r.conclusion, startedAt, ageHours, state };
      } catch {
        return { ...w, status: "unknown", conclusion: null, startedAt: null, ageHours: null, state: "unknown" as const };
      }
    }),
  );

  // 3. Telegram 通道（只驗 Bot 身份，唔發訊息）＋最近告警狀態
  const jobTicks: { job: string; label: string; at: string | null; status: "ok" | "fail"; stale: boolean }[] = [];
  let telegram: { ok: boolean; detail: string; chatLinked: boolean; failing: { key: string; fail: string; sentAt: string | null }[] } = {
    ok: false,
    detail: "未檢查",
    chatLinked: false,
    failing: [],
  };
  try {
    const lovable = process.env["LOVABLE_API_KEY"];
    const key = process.env["TELEGRAM_API_KEY"];
    if (!lovable || !key) telegram.detail = "通道未設定";
    else {
      const res = await fetch("https://connector-gateway.lovable.dev/telegram/getMe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovable}`, "X-Connection-Api-Key": key },
        body: "{}",
        signal: AbortSignal.timeout(8000),
      });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: { username?: string }; description?: string };
      telegram.ok = res.ok && j.ok !== false;
      telegram.detail = telegram.ok ? `@${j.result?.username ?? "bot"} 通道正常` : `通道異常（${res.status} ${j.description ?? ""}）`;
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("telegram_alert_state").select("key,value");
    for (const r of (data ?? []) as { key: string; value: { id?: number; fail?: string | null; sent_at?: string | null } }[]) {
      if (r.key === "chat_id" && r.value?.id) telegram.chatLinked = true;
      if (r.key.startsWith("alert:") && r.value?.fail) telegram.failing.push({ key: r.key.slice(6), fail: r.value.fail, sentAt: r.value.sent_at ?? null });
      if (r.key.startsWith("job_tick:")) {
        const job = r.key.slice(9);
        const watch = JOB_TICK_WATCHES.find((w) => w.job === job);
        const tick = parseJobTick(r.value);
        const atMs = tick ? Date.parse(tick.at) : NaN;
        jobTicks.push({
          job,
          label: watch?.label ?? job,
          at: tick?.at ?? null,
          status: tick?.status ?? "fail",
          stale: !Number.isFinite(atMs) || Date.now() - atMs > (watch?.maxAgeMs ?? 30 * 60_000),
        });
      }
    }
  } catch (e) {
    telegram = { ...telegram, ok: false, detail: `檢查失敗：${String(e).slice(0, 120)}` };
  }

  return { checkedAt: new Date().toISOString(), lastDividend, workflows, telegram, jobTicks: jobTicks.slice().sort((a, b) => a.job.localeCompare(b.job)) };
}
