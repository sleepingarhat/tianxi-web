import type { readRacingHealth } from './racing-health.server';
import { JOB_TICK_WATCHES } from './job-ticks';

type Health = Awaited<ReturnType<typeof readRacingHealth>>;

/** Explicit allowlist; internal diagnostics and future fields never pass through. */
export function publicRacingHealth(d: Health) {
  return {
    checkedAt: d.checkedAt,
    lastDividend: d.lastDividend ? { date: d.lastDividend.date, committedAt: d.lastDividend.committedAt } : null,
    workflows: d.workflows.map(w => ({
      label: w.label, file: w.file, status: w.status, conclusion: w.conclusion,
      startedAt: w.startedAt, ageHours: w.ageHours, state: w.state,
    })),
    telegram: { ok: d.telegram.ok && d.telegram.chatLinked, openAlerts: d.telegram.failing.length },
    jobTicks: d.jobTicks.filter(t => JOB_TICK_WATCHES.some(w => w.job === t.job)).map(t => ({
      label: t.label, at: t.at, status: t.status, stale: t.stale,
    })),
  };
}