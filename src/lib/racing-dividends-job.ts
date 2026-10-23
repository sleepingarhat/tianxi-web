/** Job-local retries and notification state; never changes dividend evidence. */
export type DividendAlertState = {
  failures: number;
  firstFailedAt: string | null;
  lastError: string | null;
  alertedAt: string | null;
  recoveredAt: string | null;
};
export type DividendAlertStore = {
  read: (key: string) => Promise<unknown>;
  write: (key: string, state: DividendAlertState) => Promise<void>;
  send: (text: string) => Promise<{ sent: boolean }>;
};
const SIX_HOURS = 6 * 60 * 60 * 1000;
const emptyState = (): DividendAlertState => ({ failures: 0, firstFailedAt: null, lastError: null, alertedAt: null, recoveredAt: null });

export function dividendJobError(error: unknown): string {
  const message = error instanceof Error ? error.message || error.name : typeof error === 'string' ? error : 'unknown';
  return message.replace(/[\r\n\t]+/g, ' ').slice(0, 120);
}

function parseState(value: unknown): DividendAlertState {
  if (value === null) return emptyState();
  if (!value || typeof value !== 'object') throw new Error('invalid-alert-state');
  const r = value as Record<string, unknown>;
  if (typeof r['failures'] !== 'number' || !Number.isSafeInteger(r['failures']) || r['failures'] < 0) throw new Error('invalid-alert-state');
  const timestamp = (key: string) => {
    const v = r[key];
    if (v == null) return null;
    if (typeof v !== 'string' || !Number.isFinite(Date.parse(v))) throw new Error('invalid-alert-state');
    return v;
  };
  return { failures: r['failures'], firstFailedAt: timestamp('firstFailedAt'), lastError: typeof r['lastError'] === 'string' ? r['lastError'] : null, alertedAt: timestamp('alertedAt'), recoveredAt: timestamp('recoveredAt') };
}

/** Fail closed on state errors: persist notification reservation before attempting delivery. */
export async function updateDividendAlert(store: DividendAlertStore, key: string, result: { ok: true; recovery: string } | { ok: false; error: string; warning: string }, now = new Date()): Promise<void> {
  try {
    let previous: DividendAlertState;
    let readable = true;
    try { previous = parseState(await store.read(key)); }
    catch { previous = emptyState(); readable = false; }
    const at = now.toISOString();
    if (result.ok) {
      // Unknown history must never cause a recovery message.
      if (!readable) return;
      const next: DividendAlertState = { ...previous, failures: 0, firstFailedAt: null, lastError: null, alertedAt: null, recoveredAt: previous.alertedAt ? at : previous.recoveredAt };
      await store.write(key, next);
      if (previous.alertedAt) {
        const sent = await store.send(result.recovery).catch(() => ({ sent: false }));
        // Unsuccessful delivery remains pending; it is not a recovery receipt.
        if (!sent.sent) await store.write(key, { ...next, alertedAt: previous.alertedAt, lastError: previous.lastError, recoveredAt: previous.recoveredAt });
      }
      return;
    }
    const next: DividendAlertState = {
      failures: readable ? Math.min(previous.failures + 1, Number.MAX_SAFE_INTEGER) : 1,
      firstFailedAt: previous.failures > 0 ? previous.firstFailedAt ?? at : at,
      lastError: result.error,
      alertedAt: previous.alertedAt,
      recoveredAt: previous.recoveredAt,
    };
    const due = readable && next.failures >= 2 && (!previous.alertedAt || now.getTime() - Date.parse(previous.alertedAt) >= SIX_HOURS || previous.lastError !== result.error);
    if (due) next.alertedAt = at;
    // If a write fails, no notification is sent, preventing uncontrolled repeats.
    await store.write(key, next);
    if (due) {
      const sent = await store.send(result.warning).catch(() => ({ sent: false }));
      if (!sent.sent) await store.write(key, { ...next, alertedAt: previous.alertedAt, lastError: previous.lastError });
    }
  } catch (error) { console.error('dividends-alert-state', error); }
}

export async function retryDividendMeeting<T>(collect: () => Promise<T>, wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))): Promise<{ ok: true; result: T; attempts: number } | { ok: false; error: string; attempts: number }> {
  for (let attempts = 1; attempts <= 2; attempts++) {
    try { return { ok: true, result: await collect(), attempts }; }
    catch (error) {
      if (attempts === 2) return { ok: false, error: dividendJobError(error), attempts };
      await wait(3000);
    }
  }
  return { ok: false, error: 'unknown', attempts: 2 };
}