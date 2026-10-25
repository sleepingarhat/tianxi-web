import { parse } from 'node-html-parser';

export type OfficialRunnerResult = {
  raceNumber: number; horseNumber: number; horseId: string; finishingPosition: number | null;
  winOdds: number | null; runningPosition: string | null; jockeyId: string; trainerId: string;
};

/** HKJC withdrawal codes that may appear without a horse number. */
const UNNUMBERED_WITHDRAWN = /^(?:WV|WX)(?:-A)?$/i;

/** Parse only the complete official performance table; never incident/dividend tables. */
export function parseOfficialResults(html: string, date: string, raceNumber: number): OfficialRunnerResult[] {
  const root = parse(html);
  const selected = root.querySelector('option[selected]')?.text.trim();
  const parts = date.split('-');
  if (selected !== `${parts[2]}/${parts[1]}/${parts[0]}`) throw new Error('official-result-date-mismatch');
  if (!new RegExp(`^RACE\\s+${raceNumber}\\s*\\(`).test(root.querySelector('.race_tab')?.text.trim() ?? '')) throw new Error('official-result-race-mismatch');
  const table = root.querySelector('.performance table.draggable');
  if (!table || !table.querySelector('thead')?.text.includes('Win Odds')) throw new Error('official-result-table-missing');
  const seen = new Set<number>();
  const ids = new Set<string>();
  const rows = table.querySelectorAll('tbody > tr').flatMap(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length !== 12) throw new Error('official-result-columns-incomplete');
    const text = (i: number) => cells[i]?.text.trim() ?? '';
    const horseNumber = Number(text(1));
    const horseUrl = cells[2]?.querySelector('a[href*="horseid="]')?.getAttribute('href');
    const fullId = horseUrl ? new URL(horseUrl, 'https://racing.hkjc.com').searchParams.get('horseid') : null;
    const horseId = fullId?.match(/^HK_\d{4}_([A-Z]\d{3})$/)?.[1];
    const place = text(0);
    // Official withdrawn rows (WV/WV-A vet, WX/WX-A stewards) can have no
    // current race number. Keep their evidence in raw HTML, not a fabricated
    // number or the replacement's ID. Coverage still requires every card
    // starter to be matched or independently proven withdrawn.
    if (text(1) === '' && UNNUMBERED_WITHDRAWN.test(place) && horseId) return [];
    // Blank is not a loss. Collector must independently verify official withdrawal.
    const finishingPosition = place === '' ? null : /^\d+$/.test(place) ? Number(place) : /^(?:DNF|PU|UR|FE|DISQ|WX(?:-A)?|WV(?:-A)?|VOID)$/i.test(place) ? null : undefined;
    if (!Number.isInteger(horseNumber) || horseNumber < 1 || !horseId || seen.has(horseNumber) || ids.has(horseId) || finishingPosition === undefined) throw new Error('official-result-runner-invalid');
    seen.add(horseNumber); ids.add(horseId);
    const profile = (i: number, key: string) => {
      const url = cells[i]?.querySelector('a')?.getAttribute('href');
      return url ? new URL(url, 'https://racing.hkjc.com').searchParams.get(key) ?? '' : '';
    };
    const odds = Number(text(11));
    return [{ raceNumber, horseNumber, horseId, finishingPosition,
      winOdds: Number.isFinite(odds) && odds > 0 ? odds : null,
      runningPosition: text(9).replace(/\s+/g, ' ') || null,
      jockeyId: profile(3, 'jockeyid'), trainerId: profile(4, 'trainerid') }];
  });
  if (rows.length < 4 || !rows.some(r => r.finishingPosition === 1)) throw new Error('official-result-incomplete');
  return rows;
}

/** No result may publish until all current-card starters are accounted for by identity. */
export function verifyOfficialResultCoverage(results: OfficialRunnerResult[], card: {horseNumber: number; horseId: string}[], withdrawn: ReadonlySet<number>, offCardWithdrawn: ReadonlySet<string> = new Set()) {
  if (card.length < 4) throw new Error('official-card-incomplete');
  // D1 uses horse_K001; official links use HK_YYYY_K001. Strip only
  // the documented storage prefix, never fuzzy-match different identities.
  const canonical = (id: string) => /^horse_[A-Z]\d{3}$/.test(id) ? id.slice(6) : id;
  const expected = new Map(card.map(r => [r.horseNumber, canonical(r.horseId)]));
  if (expected.size !== card.length) throw new Error('official-card-duplicate');
  for (const r of results) {
    // Pre-lock withdrawn runners are removed from the current card, yet HKJC
    // still lists them without a placing. Skip only an exact official-notice
    // identity ("horseNumber:horseId"); anything else off-card still blocks.
    if (!expected.has(r.horseNumber)) {
      if (r.finishingPosition === null && offCardWithdrawn.has(`${r.horseNumber}:${r.horseId}`)) continue;
      throw new Error('official-result-identity-mismatch');
    }
    if (expected.get(r.horseNumber) !== r.horseId) throw new Error('official-result-identity-mismatch');
    if (withdrawn.has(r.horseNumber) && r.finishingPosition !== null) throw new Error('withdrawn-runner-has-placing');
    if (r.finishingPosition === null && !withdrawn.has(r.horseNumber)) throw new Error('nonfinisher-needs-separate-evidence');
    if (r.finishingPosition !== null && (!r.jockeyId || !r.trainerId)) throw new Error('actual-rider-missing');
  }
  for (const r of card) if (!withdrawn.has(r.horseNumber) && !results.some(x => x.horseNumber === r.horseNumber && x.horseId === canonical(r.horseId))) throw new Error('official-result-starter-missing');
}