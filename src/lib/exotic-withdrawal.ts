/**
 * HKJC Rule 3.10(b)(iii) for Double Trio / Triple Trio original tickets:
 * a withdrawn selection is replaced by the official favourite (then 2nd, 3rd…)
 * not already selected in each original three-horse combination.
 * Without official favourite evidence the leg is pending — never refund or loss.
 */
export type TrioLeg = { race: number; bankers: number[]; legs: number[] };
export type LegSettlement = { status: 'unchanged' | 'substituted' | 'pending'; leg: TrioLeg; withdrawn: number[]; combinations: number[][] | null };

export function settleWithdrawnLeg(leg: TrioLeg, withdrawn: ReadonlySet<number>, favourites?: readonly number[] | null): LegSettlement {
  const selections = [...leg.bankers, ...leg.legs];
  const hit = selections.filter(n => withdrawn.has(n));
  const original = leg.legs.map(n => [...leg.bankers, n]);
  const pending = (): LegSettlement => ({ status: 'pending', leg, withdrawn: hit, combinations: null });
  if (leg.bankers.length !== 2 || !leg.legs.length || new Set(selections).size !== selections.length || selections.some(n => !Number.isInteger(n) || n <= 0)) return pending();
  if (!hit.length) return { status: 'unchanged', leg, withdrawn: [], combinations: original };
  if (!favourites?.length || new Set(favourites).size !== favourites.length) return pending();
  const combinations: number[][] = [];
  for (const ticket of original) {
    const taken = new Set(ticket.filter(n => !withdrawn.has(n)));
    const pool = favourites.filter(n => Number.isInteger(n) && n > 0 && !withdrawn.has(n) && !taken.has(n));
    const next: number[] = [];
    for (const n of ticket) {
      const replacement = withdrawn.has(n) ? pool.shift() : n;
      if (replacement === undefined) return pending();
      next.push(replacement);
    }
    combinations.push(next); // Repeated settled triples retain their original stake multiplicity.
  }
  const first = combinations[0];
  const sameBankers = first && combinations.every(c => c[0] === first[0] && c[1] === first[1]);
  const next = sameBankers ? { race: leg.race, bankers: first.slice(0, 2), legs: combinations.map(c => c[2] ?? 0) } : leg;
  return { status: 'substituted', leg: next, withdrawn: hit, combinations };
}
