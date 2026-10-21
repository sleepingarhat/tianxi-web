import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
export const getWithdrawalTracker = createServerFn({method:'GET'})
  .inputValidator((data: {date:string}) => z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).parse(data))
  .handler(async ({data}) => {
    const { readLatestHkjcChanges } = await import('./hkjc-changes.server');
    const { readFrozenRacing } = await import('./frozen-racing.server');
    const { frozenEvidenceCodeOf } = await import('./frozen-racing');
    const { summarizeOfficialMetrics } = await import('./racing-official-metrics');
    const { horseDisplayName } = await import('./horse-name');
    const snap = await readLatestHkjcChanges(data.date);
    let frozen: Awaited<ReturnType<typeof readFrozenRacing>> | null = null;
    let evidence = 'available';
    try { frozen=await readFrozenRacing(data.date); } catch(e) { evidence=frozenEvidenceCodeOf(e); }
    const withdrawals = ((snap?.changes as import('./hkjc-changes').HkjcChange[] | undefined) ?? []).filter(c=>c.kind==='scratched'||c.kind==='replaced');
    return {
      date:data.date, source:snap?.source_url ?? null, sha256:snap?.sha256 ?? null, fetchedAt:snap?.fetched_at ?? null,
      frozenEvidence:evidence, frozenSha:frozen?.snapshot.sha256 ?? null, lockAt:frozen?.lockAt ?? null,
      summary:frozen ? summarizeOfficialMetrics(frozen.races.map(r=>r.metricInput)) : null,
      withdrawals:withdrawals.map(c=>{
        const race=frozen?.races.find(r=>r.raceNumber===c.raceNumber);
        const pick=race?.picks.find(p=>p.horseNumber===c.horseNumber&&horseDisplayName(p.nameCh,p.horseId)===c.horseName);
        return {...c, originalRank:pick?.rank ?? null,
          beforeLock:frozen && c.announcedAtIso ? Date.parse(c.announcedAtIso)<=Date.parse(frozen.lockAt) : null,
          originalHits:race?.officialMetric.originalHits ?? null, metricEligible:race?.officialMetric.eligible ?? false,
          trainingStatus:'unverified' as const};
      }),
    };
  });