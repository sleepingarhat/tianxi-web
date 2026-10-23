export const HORSE_ID = /^horse_[A-Z]{1,2}[0-9]{3}$/;
export type WatchRow = { user_id: string; horse_id: string; horse_name: string | null; paused: boolean; activated_at: string; created_at: string; notify_entry: boolean; notify_trial: boolean; notify_trackwork: boolean; notify_injury: boolean; notify_push: boolean; notify_telegram: boolean };
export type WatchList = { rows: WatchRow[]; limit: number; proLimit: number; activeCount: number; pausedCount: number; tier: string; gateOpen: boolean };
export function watchLimitMessage(limit: number, proLimit: number, gateOpen: boolean, tier: string) { return !gateOpen ? `閘前每人最多追蹤 ${limit} 匹` : tier === 'pro' ? `已達 Pro 上限 ${limit} 匹` : `免費會員最多追蹤 ${limit} 匹，升級 Pro 可追蹤 ${proLimit} 匹`; }
export function enforceWatchRows(rows: WatchRow[], limit: number) { return [...rows].sort((a,b)=> Number(a.paused)-Number(b.paused) || b.activated_at.localeCompare(a.activated_at) || b.created_at.localeCompare(a.created_at) || a.horse_id.localeCompare(b.horse_id)).map((r,i)=>({...r,paused:i>=limit})); }
export function readPendingFollow(value: string | null, now=Date.now()): {horseId:string;horseName:string;ts:number} | null { try { const p=JSON.parse(value ?? 'null'); return p && HORSE_ID.test(p.horseId) && typeof p.horseName==='string' && Number.isFinite(p.ts) && now-p.ts>=0 && now-p.ts<86400000 ? p : null; } catch { return null; } }
export function validHorseSearch(q: string) { return /[\u3400-\u9fff]/.test(q) ? q.trim().length>=1 : q.trim().length>=2; }

export function applyWatchLimitTransition(rows: WatchRow[], limit: number, previousLimit: number | null) { return previousLimit===limit ? rows.map(r=>({...r})) : enforceWatchRows(rows,limit); }
