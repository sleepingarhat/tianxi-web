export type EvidenceIdentity = { raceId: string; horseId: string; date: string; venue: string; raceNumber: number };
export type FrozenEvidenceBody = { frozen?: boolean; date?: string; venue?: string; races?: { raceId?: string | null; raceNumber?: number | string; picks?: { horseId?: string }[] }[] };

export function frozenEvidenceAllows(body: FrozenEvidenceBody, id: EvidenceIdentity, pro: boolean) {
  if (!pro && id.raceNumber !== 1) return false;
  return body.frozen === true && body.date === id.date && body.venue === id.venue &&
    Boolean(body.races?.some(r => (r.raceId === id.raceId || (!r.raceId && Number(r.raceNumber) === id.raceNumber)) &&
      r.picks?.some(p => p.horseId === id.horseId)));
}

export function evidenceIdentity(raceId: string, horseId: string): EvidenceIdentity {
  const match = /^race_(\d{4}-\d{2}-\d{2})_(ST|HV)_(\d+)$/.exec(raceId);
  const [, date, venue, number] = match ?? [];
  if (!date || !venue || !number || Number(number) < 1) throw new Error("場次識別無效");
  return { raceId, horseId, date, venue, raceNumber: Number(number) };
}