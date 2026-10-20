import { Link } from '@tanstack/react-router';
import type { HkjcChangesSnapshot } from '@/lib/hkjc-changes.functions';

export function RacingChangesNotice({ snapshot, failed }: { snapshot: HkjcChangesSnapshot | undefined; failed: boolean }) {
  const changes = [...(snapshot?.changes ?? [])].sort((a, b) => (b.announcedAtIso ?? '').localeCompare(a.announcedAtIso ?? ''));
  if (!changes.length && !failed) return null;
  return (
    <section aria-label="馬會退出通知" aria-live="polite" className="mx-4 my-3 border-l-4 border-lose bg-paper-2 px-3 py-2 text-[11px]">
      <p className="font-bold text-ink">賽事更改後更新</p>
      {changes.map(c => <p key={`${c.raceNumber}:${c.horseNumber}:${c.announcedAt}`} className="mt-1 break-words text-ink">第{c.raceNumber}場 · {c.horseNumber}號 {c.horseName}：{c.text} <span className="text-ink-3">（{c.announcedAt} HKT）</span></p>)}
      {failed ? <p role="alert" className="mt-1 text-lose">最新公告讀取失敗；以下只保留上次已核實紀錄，未能確認有冇新增更改。</p> : null}
      {snapshot ? <p className="mt-1 text-ink-3">公告存檔：{new Date(Date.parse(snapshot.fetched_at) + 8 * 3600_000).toISOString().slice(11, 19)} HKT</p> : null}
      <Link to="/race-changes" className="mt-1 inline-block font-bold text-gold">更改內容及重算時間 →</Link>
    </section>
  );
}