import { load } from 'cheerio/slim';
import type { DividendRow } from './raceDividends';

export type DividendEvidence = { rows: DividendRow[]; trios: Record<number, string>; raceCount: number };
/** Absence of a main-prize row is NOT evidence of zero payout. */
export function parseOfficialDividends(html: string, date: string, venue: string, expectedRaces: number): DividendEvidence {
  const $ = load(html);
  const [year, month, day] = date.split('-');
  const dateLabel = `${day}/${month}/${year}`;
  if ($('#selectId option[selected]').text().trim() !== dateLabel) throw new Error('dividend-date-mismatch');
  const links = $('a[href*="localresults"]').toArray().map(a => $(a).attr('href') ?? '');
  if (!links.some(h => h.includes(`Racecourse=${venue}`) && h.toLowerCase().includes(`racedate=${year}/${month}/${day}`))) throw new Error('dividend-venue-mismatch');
  const rows: DividendRow[] = [], trios: Record<number, string> = {};
  const sections = $('.race_result > div').toArray().filter(el => /第\s*\d+\s*場/.test($(el).text()) && $(el).find('table.dividends').length);
  const seen = new Set<number>();
  for (const section of sections) {
    const race = Number(/第\s*(\d+)\s*場/.exec($(section).text())?.[1]);
    if (seen.has(race) || race < 1 || race > expectedRaces) throw new Error('dividend-race-identity');
    seen.add(race);
    let pool = '';
    $(section).find('table.dividends tbody tr').each((_, tr) => {
      const cells = $(tr).children('td').toArray().map(td => $(td).text().trim());
      if (cells.length === 3) pool = cells.shift() ?? '';
      if (cells.length !== 2 || !pool) throw new Error('dividend-row-shape');
      if (/騎師王|練馬師王/.test(pool)) return;
      const combo = cells[0] ?? '', value = (cells[1] ?? '').replaceAll(',', '');
      if (!/^\d+(?:\.\d+)?$/.test(value)) throw new Error('dividend-unverified-amount');
      rows.push({ race_no: race, pool, combo, dividend: Number(value), unit: 10 });
      if (pool === '單T' && /^\d+,\d+,\d+$/.test(combo) && new Set(combo.split(',')).size === 3) {
        if (trios[race] && trios[race] !== combo) throw new Error('dividend-multiple-trio-combinations');
        trios[race] = combo;
      }
    });
  }
  if (seen.size !== expectedRaces || Object.keys(trios).length !== expectedRaces) throw new Error('dividend-coverage-incomplete');
  return { rows, trios, raceCount: seen.size };
}