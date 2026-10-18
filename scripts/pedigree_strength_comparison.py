"""Offline pedigree-strength factor comparison. Read-only research; no prediction writes.

Adds a 9th 'pedigree strength' factor on top of the existing 8 factors (factor_bonus):
  strength = 0.5*sire_top3_sm + 0.3*damsire_top3_sm + 0.2*sire_sprint_top3_sm
All components use strictly earlier-date progeny aggregates (K=40 smoothing, prior=overall).
Precocity proxy = sire progeny top3 rate at sprint distances (<=1200m), earlier dates only.
Rank score = blend_z + (factor_bonus + STRENGTH_K * z(strength)) * 0.005, STRENGTH_K=1.0.
Reuses saved per-day horses CSVs (withLogp/withoutLogp) — no model retraining.
"""
import json
from pathlib import Path

import numpy as np
import pandas as pd

from pedigree_contract import smooth

ROOT = Path(__file__).resolve().parent.parent
SRC = Path('/tmp/pf')
RESULTS = SRC / 'results'
OUT = ROOT / 'public/reports/pedigree-strength-2026-10-19'
STRENGTH_K = 1.0
SPRINT_MAX = 1200


def z(values):
    v = np.asarray(values, float)
    sd = v.std(ddof=1) if len(v) > 1 else 1
    return (v - v.mean()) / (sd if sd > 0 else 1)


def earlier_date_pedigree(rows, aggregates, pedigree):
    """Strictly earlier-date sire/damsire/sire-sprint smoothed top3 rates per runner."""
    from collections import defaultdict
    by_date = defaultdict(list)
    for r in aggregates:
        by_date[r['race_date']].append(r)
    source_dates = sorted(by_date)
    targets = defaultdict(list)
    for r in rows:
        targets[r['race_date']].append(r)
    cursor = 0
    overall = [0, 0]
    sire, damsire, sprint = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    out = {}
    for date in sorted(targets):
        while cursor < len(source_dates) and source_dates[cursor] < date:
            for r in by_date[source_dates[cursor]]:
                n, hit = r['starts'], r['top3']
                overall[0] += n
                overall[1] += hit
                if r.get('sire'):
                    sire[r['sire']][0] += n
                    sire[r['sire']][1] += hit
                    if r.get('distance') and r['distance'] <= SPRINT_MAX:
                        sprint[r['sire']][0] += n
                        sprint[r['sire']][1] += hit
                if r.get('damsire'):
                    damsire[r['damsire']][0] += n
                    damsire[r['damsire']][1] += hit
            cursor += 1
        prior = overall[1] / overall[0] if overall[0] else .30
        for r in targets[date]:
            p = pedigree.get(r['horse_id'], {})
            s, ds = p.get('sire'), p.get('damsire')
            out[(r['race_id'], r['horse_id'])] = {
                'sire_sm': smooth(*sire[s], prior) if s else None,
                'damsire_sm': smooth(*damsire[ds], prior) if ds else None,
                'sprint_sm': smooth(*sprint[s], prior) if s else None,
            }
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(SRC / 'research-input.csv.gz')
    pedigree = {r['horse_id']: r for r in json.loads((SRC / 'pedigree.json').read_text())}
    progeny = json.loads((SRC / 'progeny.json').read_text())
    rows = df[['race_date', 'race_id', 'horse_id', 'distance']].to_dict('records')
    ped_values = earlier_date_pedigree(rows, progeny, pedigree)

    horses = pd.concat(
        [pd.read_csv(p) for p in sorted(RESULTS.glob('2026-??-??-horses.csv'))],
        ignore_index=True,
    )
    if horses.duplicated(['race_id', 'horse_id']).any():
        raise ValueError('Duplicate horse rows')
    horses = horses.merge(df[['race_id', 'horse_id', 'distance', 'factor_bonus']], on=['race_id', 'horse_id'], how='left', validate='one_to_one')
    horses['sire_sm'] = [ped_values[(r.race_id, r.horse_id)]['sire_sm'] for r in horses.itertuples()]
    horses['damsire_sm'] = [ped_values[(r.race_id, r.horse_id)]['damsire_sm'] for r in horses.itertuples()]
    horses['sprint_sm'] = [ped_values[(r.race_id, r.horse_id)]['sprint_sm'] for r in horses.itertuples()]

    races = []
    for rid, g in horses.groupby('race_id', sort=False):
        g = g.copy()
        for col in ['sire_sm', 'damsire_sm', 'sprint_sm']:
            fill = g[col].mean()
            g[col] = g[col].fillna(fill if np.isfinite(fill) else .30)
        g['strength'] = .5 * g.sire_sm + .3 * g.damsire_sm + .2 * g.sprint_sm
        sz = z(g.strength)
        for b in ['with', 'without']:
            blend = .88 * z(g[b + 'Logp']) + .12 * z(g.servingElo)
            adj = g.factor_bonus * .005
            if b == 'with':
                adj = adj + STRENGTH_K * sz * .005
            score = pd.Series(blend + adj, index=g.index)
            g[b + 'StrengthRank'] = score.rank(ascending=False, method='first').astype(int)
        win = g.finishing_position.between(1, 4)
        debut = g.first_starter
        rec = {'date': g.race_date.iloc[0], 'raceId': rid, 'runners': len(g), 'firstStarters': int(debut.sum())}
        for b in ['with', 'without']:
            pick = g[b + 'StrengthRank'] <= 4
            rec[b + 'Hits'] = int((pick & win).sum())
            rec[b + 'DebutSelected'] = int((pick & debut).sum())
            rec[b + 'DebutHits'] = int((pick & debut & win).sum())
        rec['top4Changed'] = set(g[g.withStrengthRank <= 4].horse_id) != set(g[g.withoutStrengthRank <= 4].horse_id)
        races.append(rec)
        horses.loc[g.index, ['strength', 'withStrengthRank', 'withoutStrengthRank']] = g[['strength', 'withStrengthRank', 'withoutStrengthRank']]

    r = pd.DataFrame(races)

    def group(g):
        n = len(g)
        out = {'races': n}
        for b in ['with', 'without']:
            hits = int(g[b + 'Hits'].sum())
            sel = int(g[b + 'DebutSelected'].sum())
            dh = int(g[b + 'DebutHits'].sum())
            out[b + 'Hits'] = hits
            out[b + 'MeanHits'] = hits / n if n else None
            out[b + 'PickHitRate'] = hits / (4 * n) if n else None
            out[b + 'DebutSelected'] = sel
            out[b + 'DebutHits'] = dh
            out[b + 'DebutHitRate'] = dh / sel if sel else None
        out['meanHitChange'] = (out['withHits'] - out['withoutHits']) / n if n else None
        out['pickHitRateChangePp'] = 100 * (out['withHits'] - out['withoutHits']) / (4 * n) if n else None
        out['improvedRaces'] = int((g.withHits > g.withoutHits).sum())
        out['worseRaces'] = int((g.withHits < g.withoutHits).sum())
        out['unchangedRaces'] = int((g.withHits == g.withoutHits).sum())
        out['top4ChangedRaces'] = int(g.top4Changed.sum())
        return out

    debut = r[r.firstStarters > 0]
    daily = []
    for date, g in r.groupby('date', sort=True):
        sub = g[g.firstStarters > 0]
        daily.append({'date': date, 'allRaces': len(g), 'debutHorses': int(g.firstStarters.sum()), **group(sub)})
    valid = [d for d in daily if d['races']]
    rng = np.random.default_rng(42)
    if len(valid) > 1:
        counts = np.array([d['races'] for d in valid])
        delta = np.array([d['withHits'] - d['withoutHits'] for d in valid])
        idx = rng.integers(0, len(valid), (10000, len(valid)))
        ci = np.quantile(delta[idx].sum(1) / counts[idx].sum(1), [.025, .975]).tolist()
    else:
        ci = [None, None]

    summary = {
        'status': 'EXPLORATORY_NOT_WEIGHT_APPROVAL',
        'scope': 'PEDIGREE_STRENGTH_AS_9TH_FACTOR_ON_TOP_OF_8',
        'formula': 'strength = 0.5*sire_top3_sm + 0.3*damsire_top3_sm + 0.2*sire_sprint_top3_sm(<=1200m); rank = blend_z + (factor_bonus + 1.0*z(strength))*0.005',
        'strengthK': STRENGTH_K,
        'productionPromoted': False,
        'frozenWrites': False,
        'pedigreeWeightChanged': False,
        'all': group(r),
        'debut': group(debut),
        'debutHorses': int(horses.first_starter.sum()),
        'days': daily,
        'pairedDateBootstrap95': ci,
        'improvedDays': sum(d['meanHitChange'] > 0 for d in valid),
        'worseDays': sum(d['meanHitChange'] < 0 for d in valid),
        'unchangedDays': sum(d['meanHitChange'] == 0 for d in valid),
        'limitations': [
            '早熟程度以父系後代短途(<=1200米)頭三率作代理，唔係真正兩歲早熟數據。',
            '血統強度只加喺排名調整項(factor_bonus×0.005)，模型特徵及權重不變。',
            '血統平滑只用嚴格較早賽日，K=40；缺值用同場平均補。',
            'STRENGTH_K=1.0 係研究設定，未經調參驗收；結果唔代表加重後正式表現。',
            '研究重播唔係歷史凍結分數；凍結預測、副本及戰績不變。',
        ],
    }
    r.to_csv(OUT / 'races.csv', index=False)
    horses.to_csv(OUT / 'horses.csv', index=False)
    (OUT / 'summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2, allow_nan=False))
    print(json.dumps({'all': summary['all'], 'debut': summary['debut'], 'ci': ci,
                      'days': [summary['improvedDays'], summary['worseDays'], summary['unchangedDays']]}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
