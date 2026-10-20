import type { HkjcChange } from './hkjc-changes';

export type ChangeProgress = { revision: string; phase: string; requested_at: string | null; recomputed_at: string | null; generated_at: string | null; checked_at: string };
export const changeKey = (c: HkjcChange) => `R${c.raceNumber} #${c.horseNumber} ${c.horseName} · ${c.announcedAt} · ${c.text}`;
export const changeRevision = (changes: HkjcChange[]) => JSON.stringify([...new Set(changes.map(changeKey))].sort());

export function progressForChange(c: HkjcChange, rows: ChangeProgress[]) {
  const key = changeKey(c);
  return rows.filter(row => {
    try { const keys: unknown = JSON.parse(row.revision); return Array.isArray(keys) && keys.includes(key); }
    catch { return false; }
  }).sort((a,b) => b.checked_at.localeCompare(a.checked_at))[0] ?? null;
}

export function verifiedUpdate(row: ChangeProgress | null) {
  return row?.phase === 'clean' && Number.isFinite(Date.parse(row.recomputed_at ?? '')) && Number.isFinite(Date.parse(row.generated_at ?? ''));
}

export function progressLabel(row: ChangeProgress | null) {
  if (!row) return '等待自動更新';
  if (verifiedUpdate(row)) return '已重算並核對';
  if (row.phase === 'lock-unknown-or-closed') return '鎖點已到或未核實，不重算原紀錄';
  if (row.phase === 'waiting-card' || row.phase === 'dispatch-intent') return '排位更新中';
  if (row.phase === 'recompute-intent') return '重算中';
  if (row.phase === 'clean') return '待核實重算時間';
  return '更新未核實，自動追蹤中';
}