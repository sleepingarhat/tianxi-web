"""Isolated 52/49-feature daily research. Writes reports only, never predictions."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import types
import gzip
import numpy as np
import pandas as pd
import lightgbm as lgb
from pedigree_contract import pedigree_features, PEDIGREE_FEATURES

ROOT = Path(__file__).resolve().parents[1]

def load_helpers():
    path = ROOT / 'public/reports/repair-retraining-2026-10-18/source/predict_upcoming.py'
    spec = importlib.util.spec_from_file_location('predict_source', path)
    model = importlib.util.module_from_spec(spec); spec.loader.exec_module(model)
    sys.modules['scripts'] = types.ModuleType('scripts')
    sys.modules['scripts.backtest'] = types.ModuleType('scripts.backtest')
    sys.modules['scripts.backtest.predict_upcoming'] = model
    spec = importlib.util.spec_from_file_location('daily_source', ROOT / 'public/reports/repair-calibration-2026-10-18/source/daily_calibration.py')
    daily = importlib.util.module_from_spec(spec); spec.loader.exec_module(daily)
    return model, daily

def prepare(a):
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    df = pd.read_csv(a.input).sort_values(['race_date','race_id','horse_id']).reset_index(drop=True)
    assert not df.duplicated(['race_id','horse_id']).any()
    ped = {r['horse_id']:r for r in json.load(open(a.pedigree))}
    missing = sorted(h for h in df.horse_id.unique() if not ped.get(h,{}).get('sire') or not ped.get(h,{}).get('damsire'))
    if missing: raise ValueError(f'Pedigree incomplete: {len(missing)} horses')
    records = df[['race_date','race_id','horse_id','distance']].to_dict('records')
    values, priors = pedigree_features(records,json.load(open(a.progeny)),ped)
    before = df[PEDIGREE_FEATURES].to_numpy().copy()
    for i,r in enumerate(records): df.loc[i,PEDIGREE_FEATURES] = values[(r['race_id'],r['horse_id'])]
    delta = np.abs(df[PEDIGREE_FEATURES].to_numpy()-before)
    df.to_csv(out/'research-input.csv.gz',index=False,compression='gzip')
    summary = {'rows':len(df),'races':int(df.race_id.nunique()),'horses':int(df.horse_id.nunique()),'missingPedigree':len(missing),
      'changedFeatureRows':int((delta>1e-10).any(axis=1).sum()),'maxFeatureDelta':float(np.nanmax(delta)),
      'strength':40,'fallbackPrior':.30,'cutoff':'strictly earlier meeting date','frozenWrites':False,
      'inputSha256':hashlib.sha256(gzip.open(a.input,'rb').read()).hexdigest(),
      'researchInputSha256':hashlib.sha256(gzip.open(out/'research-input.csv.gz','rb').read()).hexdigest(),
      'pedigreeSha256':hashlib.sha256(Path(a.pedigree).read_bytes()).hexdigest(),
      'limitations':['血統身份來自現存官方來源，並非逐日歷史採集快照','初出識別以本地完整賽果庫首次出賽日；不代表海外首次出賽','只重建三項血統特徵，其他特徵維持原研究輸入','不更改正式平滑或模型權重']}
    (out/'preparation.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2,allow_nan=False))
    (out/'daily-priors.json').write_text(json.dumps(priors,indent=2))
    print(summary,flush=True)

def run(a):
    out = Path(a.out); out.mkdir(parents=True,exist_ok=True)
    m,daily = load_helpers()
    df = pd.read_csv(out/'research-input.csv.gz').sort_values(['race_date','race_id','horse_id']).reset_index(drop=True)
    # Both branches use exactly the same raw axes, fallback and field exclusion.
    vals = df[['h_elo','j_elo','t_elo']].to_numpy(float); w = np.array([.7,.2,.1]); den=(np.isfinite(vals)*w).sum(axis=1)
    df['research_elo']=np.divide(np.nansum(vals*w,axis=1),den,out=np.full(len(df),np.nan),where=den>0)
    df['baseline_score']=df.research_elo+df.factor_bonus
    first={r['horse_id']:r['first_date'] for r in json.load(open(a.first_start))}
    df['first_starter']=[first.get(h)==d and d>'2016-09-03' for h,d in zip(df.horse_id,df.race_date)]
    params={'objective':'lambdarank','metric':'None','lambdarank_truncation_level':4,'label_gain':[0,1,7,31,127],
      'learning_rate':.01,'num_leaves':8,'min_data_in_leaf':20,'verbosity':-1,'num_threads':2,'seed':42,'deterministic':True,'force_col_wise':True}
    for day in a.dates.split(','):
        if (out/f'{day}.json').exists(): continue
        past,train,val=daily.split_before(df,day)
        target=df[df.race_date==day].copy(); ids=val.race_id.to_numpy(); labels=val.is_top1.to_numpy()
        rounds=json.load(open(ROOT/f'public/reports/repair-calibration-2026-10-18/{day}.json'))['best_iteration']
        base=m.standardize_per_race(val.baseline_score.fillna(0).to_numpy(),ids)
        predictions={}; calibration={}
        for branch,cols in [('with',m.FEAT_COLS),('without',[c for c in m.FEAT_COLS if c not in PEDIGREE_FEATURES])]:
            assert len(cols)==(52 if branch=='with' else 49)
            def dataset(frame):return lgb.Dataset(frame[cols].fillna(-1).to_numpy(),label=m.make_graded_label(frame),group=frame.groupby('race_id',sort=False).size().to_numpy(),feature_name=cols)
            model=lgb.train(params,dataset(train),num_boost_round=rounds)
            raw=model.predict(val[cols].fillna(-1).to_numpy(),num_threads=2)
            tl=m.fit_temperature(raw,ids,labels);te=m.fit_temperature(base,ids,labels)
            alpha=m.fit_alpha(m.per_race_softmax(raw,ids,tl),m.per_race_softmax(base,ids,te),ids,labels)
            final=lgb.train(params,dataset(past),num_boost_round=rounds)
            final.save_model(str(out/f'{day}-{branch}-model.txt'))
            traw=final.predict(target[cols].fillna(-1).to_numpy(),num_threads=2); tids=target.race_id.to_numpy()
            tb=m.standardize_per_race(target.baseline_score.fillna(0).to_numpy(),tids)
            p=alpha*m.per_race_softmax(traw,tids,tl)+(1-alpha)*m.per_race_softmax(tb,tids,te)
            assert np.isfinite(p).all()
            predictions[branch]=np.log(np.maximum(p,1e-12))
            calibration[branch]={'features':len(cols),'rounds':rounds,'tauLgb':tl,'tauElo':te,'innerAlpha':alpha,
                'modelSha256':hashlib.sha256((out/f'{day}-{branch}-model.txt').read_bytes()).hexdigest()}
        target['withLogp']=predictions['with'];target['withoutLogp']=predictions['without']
        races=[]; details=[];excluded=[]
        for rid,g in target.groupby('race_id',sort=False):
            if len(g)!=int(g.field_size.iloc[0]) or not np.isfinite(g.research_elo).all() or not np.isfinite(g.factor_bonus).all() or not g.finishing_position.between(1,98).all():
                excluded.append(rid);continue
            g=g.copy()
            def z(v):
                v=np.asarray(v,float);sd=v.std(ddof=1) if len(v)>1 else 1
                return (v-v.mean())/(sd if sd>0 else 1)
            for branch in ['with','without']:
                blend=.88*z(g[branch+'Logp'])+.12*z(g.research_elo)
                g[branch+'Rank']=pd.Series(blend+g.factor_bonus.to_numpy()*.005,index=g.index).rank(ascending=False,method='first')
            win=g.finishing_position.between(1,4); debut=g.first_starter
            races.append({'raceId':rid,'date':day,'runners':len(g),'firstStarters':int(debut.sum()),
              'withHits':int(((g.withRank<=4)&win).sum()),'withoutHits':int(((g.withoutRank<=4)&win).sum()),
              'withDebutSelected':int(((g.withRank<=4)&debut).sum()),'withoutDebutSelected':int(((g.withoutRank<=4)&debut).sum()),
              'withDebutHits':int(((g.withRank<=4)&debut&win).sum()),'withoutDebutHits':int(((g.withoutRank<=4)&debut&win).sum())})
            details.extend(g[['race_id','horse_id','first_starter','finishing_position','withLogp','withoutLogp','withRank','withoutRank']].to_dict('records'))
        pd.DataFrame(details).to_csv(out/f'{day}-predictions.csv',index=False)
        rec={'date':day,'trainingEnd':past.race_date.max(),'validationStart':val.race_date.min(),'validationEnd':val.race_date.max(),
          'trainRows':len(train),'refitRows':len(past),'excludedRaces':excluded,'calibration':calibration,'races':races}
        (out/f'{day}.json').write_text(json.dumps(rec,indent=2,allow_nan=False));print('completed',day,'races',len(races),'debut races',sum(r['firstStarters']>0 for r in races),flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input');p.add_argument('--pedigree');p.add_argument('--progeny');p.add_argument('--first-start');p.add_argument('--out',required=True);p.add_argument('--dates',default='');p.add_argument('--prepare',action='store_true');a=p.parse_args()
    prepare(a) if a.prepare else run(a)