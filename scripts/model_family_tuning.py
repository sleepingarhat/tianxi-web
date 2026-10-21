"""Per-model grid tuning on earliest days, locked evaluation on latest days.

Phase 1 (tuning): for each model family and each parameter set, evaluate on the
earliest --tune-days race days with strict temporal splits (train < target day).
Phase 2 (locked evaluation): take each family's single best parameter set from
phase 1 and evaluate once on the latest --eval-days race days. No re-tuning on
evaluation days. Offline research only; no production writes or promotion.
"""
import argparse
import hashlib
import json
import time
from itertools import product
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
import sklearn
import xgboost as xgb
from sklearn.ensemble import RandomForestRegressor

ROOT = Path(__file__).resolve().parents[1]
SEED = 42

GRIDS = {
    'LightGBM': list(product([15, 31, 63], [3, 6], [0.03, 0.05, 0.1], [20, 50])),
    'XGBoost': list(product([4, 6, 8], [0.03, 0.05, 0.1], [1, 10, 20])),
    'Random Forest': list(product([6, 12, None], [5, 20], [0.3, 0.5, 1.0])),
}


def safe_parameters(params):
    return {key: None if isinstance(value, float) and not np.isfinite(value) else value
            for key, value in params.items()}


def complete_field(g):
    positions = g.finishing_position
    return (len(g) >= 4 and g.field_size.nunique() == 1
            and len(g) == g.field_size.iloc[0]
            and g.horse_id.nunique() == len(g)
            and g.race_date.nunique() == 1
            and positions.between(1, 98).all()
            and all((positions == rank).sum() == 1 for rank in range(1, 5)))


def graded_labels(positions):
    return np.where((positions >= 1) & (positions <= 4), 5 - positions, 0).astype(int)


def top_four(g, scores):
    order = np.lexsort((g.horse_id.to_numpy(), -np.asarray(scores)))[:4]
    chosen = g.iloc[order]
    return chosen.horse_id.tolist(), int(chosen.finishing_position.between(1, 4).sum())


def build_model(name, combo):
    if name == 'LightGBM':
        num_leaves, max_depth, lr, min_child = combo
        return lgb.LGBMRanker(objective='lambdarank', n_estimators=200, learning_rate=lr,
                              num_leaves=num_leaves, max_depth=max_depth,
                              min_child_samples=min_child, label_gain=[0, 1, 2, 3, 4],
                              lambdarank_truncation_level=4, random_state=SEED, n_jobs=2,
                              verbosity=-1, deterministic=True, force_col_wise=True)
    if name == 'XGBoost':
        max_depth, lr, min_child = combo
        return xgb.XGBRanker(objective='rank:pairwise', n_estimators=200, learning_rate=lr,
                             max_depth=max_depth, min_child_weight=min_child, subsample=1,
                             colsample_bytree=1, tree_method='hist', random_state=SEED, n_jobs=2)
    max_depth, min_leaf, max_features = combo
    return RandomForestRegressor(n_estimators=200, max_depth=max_depth,
                                 min_samples_leaf=min_leaf, max_features=max_features,
                                 random_state=SEED, n_jobs=2)


def evaluate_days(data, columns, days, models, keep_races=False):
    """models: {name: (fitted callable builder)} evaluated day by day."""
    daily = {name: [] for name in models}
    races_out = []
    for day in days:
        train = data[data.race_date < day]
        test = data[data.race_date == day]
        if train.empty or train.race_date.max() >= day:
            raise ValueError('Invalid temporal split')
        x = train[columns].replace([np.inf, -np.inf], np.nan).fillna(-1).to_numpy(dtype=np.float32)
        xt = test[columns].replace([np.inf, -np.inf], np.nan).fillna(-1).to_numpy(dtype=np.float32)
        y = graded_labels(train.finishing_position.to_numpy())
        group = train.groupby('race_id', sort=False).size().to_numpy()
        qid = np.repeat(np.arange(len(group)), group)
        predictions = {}
        for name, builder in models.items():
            model = builder()
            if name == 'LightGBM':
                model.fit(x, y, group=group)
            elif name == 'XGBoost':
                model.fit(x, y, qid=qid)
            else:
                model.fit(x, y)
            predictions[name] = model.predict(xt)
        day_hits = {name: 0 for name in models}
        for rid, g in test.groupby('race_id', sort=False):
            idx = test.index.get_indexer(g.index)
            rec = {'date': day, 'raceId': rid, 'runners': len(g),
                   'actualTop4': g[g.finishing_position.between(1, 4)]
                   .sort_values('finishing_position').horse_id.tolist(), 'models': {}}
            for name, scores in predictions.items():
                selected, hits = top_four(g, scores[idx])
                rec['models'][name] = {'selected': selected, 'hits': hits}
                day_hits[name] += hits
            if keep_races:
                races_out.append(rec)
        for name in models:
            daily[name].append((day, day_hits[name], len(test.groupby('race_id'))))
    return daily, races_out


def summarize(daily, dates, races_count, seed=SEED):
    rng = np.random.default_rng(seed)
    boot = rng.integers(0, len(dates), (10000, len(dates)))
    counts = np.array([r for _, _, r in daily])
    hits = sum(h for _, h, _ in daily)
    day_hits = np.array([h for _, h, _ in daily])
    ci = np.quantile((day_hits[boot].sum(1)) / counts[boot].sum(1), [.025, .975]).tolist()
    return {'hits': hits, 'races': races_count, 'averageHits': hits / races_count, 'ci95': ci}


def run(a):
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    frame = pd.read_csv(a.input).sort_values(['race_date', 'race_id', 'horse_id']).reset_index(drop=True)
    if frame.duplicated(['race_id', 'horse_id']).any():
        raise ValueError('Duplicate race/horse identity')
    columns = json.loads((ROOT / 'public/reports/repair-retraining-2026-10-18/meta.json').read_text())['featCols']
    if any(c not in frame for c in columns):
        raise ValueError('Missing canonical column')
    complete = [rid for rid, g in frame.groupby('race_id') if complete_field(g)]
    data = frame[frame.race_id.isin(complete)].copy()
    dates = sorted(data.race_date.unique())[-(a.tune_days + a.eval_days):]
    tune_dates, eval_dates = dates[:a.tune_days], dates[a.tune_days:]

    # Phase 1: grid tuning on earliest days.
    tuning = {}
    for name, grid in GRIDS.items():
        results = []
        for combo in grid:
            start = time.monotonic()
            daily, _ = evaluate_days(data, columns, tune_dates, {name: (lambda c=combo: build_model(name, c))})
            s = summarize(daily[name], tune_dates, sum(r for _, _, r in daily[name]))
            results.append({'params': list(combo), 'averageHits': s['averageHits'],
                            'hits': s['hits'], 'races': s['races']})
            print(f'tune {name} {combo} avg={s["averageHits"]:.4f} '
                  f'({time.monotonic() - start:.0f}s)', flush=True)
        results.sort(key=lambda r: (-r['averageHits'], r['params'].__repr__()))
        tuning[name] = {'grid': [list(c) for c in grid], 'results': results, 'best': results[0]}
        print(f'best {name}: {results[0]}', flush=True)

    # Phase 2: locked evaluation on latest days with each family's best params.
    models = {name: (lambda n=name, c=tuning[n]['best']['params']: build_model(n, c))
              for name in GRIDS}
    daily, races = evaluate_days(data, columns, eval_dates, models, keep_races=True)
    total_races = sum(r for _, _, r in daily['LightGBM'])
    summary = []
    for name in GRIDS:
        s = summarize(daily[name], eval_dates, total_races)
        s['name'] = name
        s['tunedParams'] = tuning[name]['best']['params']
        s['tuningAverageHits'] = tuning[name]['best']['averageHits']
        summary.append(s)
        print(f'eval {name}: {s}', flush=True)

    result = {'schema': 1,
              'scope': '歷史資料重建特徵 · 最早30賽日逐模型調參 · 最後30賽日鎖定評估',
              'productionPromoted': False,
              'inputSha256': hashlib.sha256(Path(a.input).read_bytes()).hexdigest(),
              'sourceRows': len(frame), 'sourceRaces': frame.race_id.nunique(),
              'completeRaces': len(complete), 'excludedRaces': int(frame.race_id.nunique() - len(complete)),
              'features': columns, 'seed': SEED, 'trees': 200,
              'tuneDates': tune_dates, 'evalDates': eval_dates,
              'tuning': tuning, 'summary': summary, 'races': races,
              'versions': {'LightGBM': lgb.__version__, 'XGBoost': xgb.__version__,
                           'sklearn': sklearn.__version__},
              'limitations': ['真實歷史賽果及現存重建特徵，不是當時公開預測；並非正式戰績。',
                              '缺失特徵一致填-1；比較模型本體，不包含正式LGB與Elo分數混合或服務校準。',
                              '調參只用最早30個賽日，最後30個賽日一次過鎖定評估，無再用評估日成績調參。',
                              '網格搜尋只涵蓋列出嘅參數組合，不保證全局最佳；樹數固定200、種子42。',
                              '往績及血統沿用現存重建欄位，未逐筆驗證歷史採集時間；不能宣稱完全排除來源層洩漏。',
                              '完整場數與頭四名唯一性才計分；並頭、不完整場次排除，不能外推全部賽事。',
                              '95%區間按30個評估賽日重抽；研究結果不構成升版批准。']}
    (out / 'summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    print(json.dumps(summary, ensure_ascii=False), flush=True)


if __name__ == '__main__':
    p = argparse.ArgumentParser()
    p.add_argument('--input', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--tune-days', type=int, default=30)
    p.add_argument('--eval-days', type=int, default=30)
    run(p.parse_args())
