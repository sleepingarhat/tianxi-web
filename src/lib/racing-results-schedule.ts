export type OfficialResultMeeting = {
  date: string;
  venueCode: string;
  status: string;
  totalNumberOfRace: number;
  races: { no: number; status: string }[];
};

/** Strict official meeting closure; partial/abandoned meetings need separate reconciliation. */
export function isConfirmedComplete(m: OfficialResultMeeting): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !['ST', 'HV'].includes(m.venueCode)) return false;
  if (m.status !== 'CLOSED' || !Number.isInteger(m.totalNumberOfRace) || m.totalNumberOfRace < 1 || m.totalNumberOfRace > 14) return false;
  if (m.races.length !== m.totalNumberOfRace) return false;
  const numbers = new Set(m.races.map(r => r.no));
  return numbers.size === m.totalNumberOfRace && m.races.every(r => Number.isInteger(r.no) && r.no >= 1 && r.no <= m.totalNumberOfRace && r.status === 'RESULT');
}

export function resultsDueAt(firstConfirmedAt: string): number {
  return Date.parse(firstConfirmedAt) + 30 * 60_000;
}