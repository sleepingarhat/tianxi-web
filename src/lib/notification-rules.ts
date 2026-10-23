import type { DayPicks } from './racing-shapes';
export const TELEGRAM_TOKEN_TTL_MS = 15 * 60_000;
export const TELEGRAM_INVITE_TTL_SECONDS = 3600;
export const LIMIT_NOTICE_INTERVAL_MS = 7 * 86400_000;
export const hkDay = (value: string | number = Date.now()) => new Date(new Date(value).getTime() + 8 * 3600_000).toISOString().slice(0, 10);
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
export type WatchEvent = { event_key: string; type: 'entry'|'trackwork'|'trial'|'injury'; horse_id: string; event_date: string; title: string; detail: Record<string, unknown> };
export type WatchFlags = { paused: boolean; created_at: string; notify_entry: boolean; notify_trackwork: boolean; notify_trial: boolean; notify_injury: boolean };
export function watchEventLine(name:string,event:WatchEvent){
  const d=event.detail ?? {};const text=(key:string)=>d[key]==null?'':String(d[key]);
  const venue=text('venue')==='ST'?'沙田':text('venue')==='HV'?'跑馬地':text('venue');
  const items=event.type==='entry'?[event.event_date,venue,text('raceNumber')&&`第${text('raceNumber')}場`,text('horseNumber')&&`${text('horseNumber')}號`,text('draw')&&`檔${text('draw')}`,text('jockey'),text('weight')&&`${text('weight')}磅`,text('priority')]:event.type==='trial'?[event.event_date,venue,text('session')&&`第${text('session')}組`,text('distance')&&`${text('distance')}米`,text('position')&&`第${text('position')}名／${text('runners')||'—'}匹`,text('time'),text('comment')]:event.type==='injury'?[event.event_date,text('injuryType')]:[event.event_date,venue,text('track'),text('workType'),text('details')];
  return `<b>${escapeHtml(name)}</b> ${escapeHtml(event.title)} · ${items.filter(Boolean).map(escapeHtml).join(' · ')}`;
}
export function acceptsWatchEvent(w: WatchFlags, event: WatchEvent, mode: string) {
  return !w.paused && w[`notify_${event.type}`] && (event.type !== 'trackwork' || mode !== 'gallop' || ['快操','試閘','出賽'].includes(String(event.detail['workType'])));
}
export function isOldWatchEvent(w: Pick<WatchFlags,'created_at'>, event: WatchEvent) {
  return event.type !== 'entry' && event.event_date < hkDay(new Date(w.created_at).getTime() - 86400_000);
}
export function raceAlertLines(day: DayPicks, hasPro: boolean) {
  if (day.edition !== 'final' || !day.frozen || !day.races?.length || !/^\d{4}-\d{2}-\d{2}$/.test(day.date ?? '') || !['ST','HV'].includes(day.venue ?? '')) return null;
  const races = day.races.filter(r => hasPro || Number(r.raceNumber) === 1);
  if (!races.length) return null;
  const lines: string[] = [];
  for (const race of races) {
    const pick = race.picks?.[0];
    if (!pick?.nameCh || pick.horseNumber == null || !race.raceNumber) return null;
    const probability = typeof pick.pWin === 'number' && Number.isFinite(pick.pWin) && pick.pWin >= 0 && pick.pWin <= 1 ? `（勝出機率 ${Math.round(pick.pWin * 100)}%）` : '';
    lines.push(`第${race.raceNumber}場 #${pick.horseNumber} ${pick.nameCh}${probability}`);
  }
  return lines;
}