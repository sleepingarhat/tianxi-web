/**
 * HKJC Rule 3.10(b)(iii) for Double Trio / Triple Trio original tickets:
 * a withdrawn selection is replaced by the official favourite (then 2nd, 3rd…)
 * not already selected in that leg. Engine substitutes are never used.
 * Without official favourite evidence the leg is pending — never refund or loss.
 */
export type TrioLeg = { race: number; bankers: number[]; legs: number[] };
export type LegSettlement = { status: 'unchanged' | 'substituted' | 'pending'; leg: TrioLeg; withdrawn: number[] };

export function settleWithdrawnLeg(leg: TrioLeg, withdrawn: ReadonlySet<number>, favourites?: readonly number[] | null): LegSettlement {
  const selections = [...leg.bankers, ...leg.legs];
  const hit = selections.filter(n => withdrawn.has(n));
  if (!hit.length) return { status: 'unchanged', leg, withdrawn: [] };
  if (!favourites?.length) return { status: 'pending', leg, withdrawn: hit };
  const taken = new Set(selections.filter(n => !withdrawn.has(n)));
  const pool = favourites.filter(n => !withdrawn.has(n) && !taken.has(n));
  const replace = (n: number) => {
    if (!withdrawn.has(n)) return n;
    const sub = pool.shift();
    if (sub == null) return NaN;
    taken.add(sub);
    return sub;
  };
  const next = { race: leg.race, bankers: leg.bankers.map(replace), legs: leg.legs.map(replace) };
  if ([...next.bankers, ...next.legs].some(n => !Number.isFinite(n))) return { status: 'pending', leg, withdrawn: hit };
  return { status: 'substituted', leg: next, withdrawn: hit };
}
