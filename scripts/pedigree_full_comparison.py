"""Offline paired pedigree ablation with full-field, seed-aware serving formula.

No production clients, credentials, network, model promotion or prediction writes.
Context is a read-only current reconstruction, NOT an immutable lock receipt.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import lightgbm as lgb
from pedigree_ablation import load_helpers, ROOT
from pedigree_contract import PEDIGREE_FEATURES

spec = importlib.util.spec_from_file_location('seed_contract', ROOT / 'public/reports/serving-parity-2026-10-18/source/meeting_seed_contract.py')
seed = importlib.util.module_from_spec(spec)
spec.loader.exec_module(seed)

def z(values):
    v = np.asarray(values, float)
    if not np.isfinite(v).all():
        raise ValueError('Incomplete/non-finite field')
    sd = v.std(ddof=1) if len(v) > 1 else 1
    return (v-v.mean()) / (sd if sd > 0 else 1)

def score_field(logp, elo, factor):
    blend = .88*z(logp) + .12*z(elo)
    return np.floor((1500+100*blend)*10+.5)/10, blend + np.asarray(factor)*.005

def complete_field(g):
    return (len(g) >= 4 and len(g) == int(g.field_size.iloc[0])
            and g.horse_id.nunique() == len(g)
            and g.horse_number.notna().all() and g.horse_number.nunique() == len(g)
            and np.isfinite(g.servingElo).all() and np.isfinite(g.factor_bonus).all()
            and g.finishing_position.between(1,98).all())

def metrics(races, horses):
    r = pd.DataFrame(races); h = pd.DataFrame(horses)
    if r.empty:
        raise ValueError('No complete paired races')
    debut = r[r.firstStarters > 0]; dh = h[h.first_starter]
    def group(g):
        n = len(g)
        result = {'races': n}
        for b in ['with','without']:
            hits = int(g[b+'Hits'].sum())
            selected = int(g[b+'DebutSelected'].sum()); debut_hits = int(g[b+'DebutHits'].sum())
            result[b+'Hits'] = hits; result[b+'MeanHits'] = hits/n if n else None
            result[b+'PickHitRate'] = hits/(4*n) if n else None
            result[b+'DebutSelected'] = selected; result[b+'DebutHits'] = debut_hits
            result[b+'DebutHitRate'] = debut_hits/selected if selected else None
        result['meanHitChange'] = (result['withHits']-result['withoutHits'])/n if n else None
        result['pickHitRateChangePp'] = 100*(result['withHits']-result['withoutHits'])/(4*n) if n else None
        result['improvedRaces'] = int((g.withHits>g.withoutHits).sum())
        result['worseRaces'] = int((g.withHits<g.withoutHits).sum())
        result['unchangedRaces'] = int((g.withHits==g.withoutHits).sum())
        result['top4ChangedRaces'] = int(g.top4Changed.sum())
        return result
    daily = []
    for date, g in r.groupby('date', sort=True):
        sub = g[g.firstStarters>0]
        daily.append({'date':date, 'allRaces':len(g), 'debutHorses':int(g.firstStarters.sum()), **group(sub)})
    valid_days = [d for d in daily if d['races']]
    rng = np.random.default_rng(42)
    if len(valid_days) > 1:
        counts = np.array([d['races'] for d in valid_days])
        delta = np.array([d['withHits']-d['withoutHits'] for d in valid_days])
        idx = rng.integers(0,len(valid_days),(10000,len(valid_days)))
        ci = np.quantile(delta[idx].sum(1)/counts[idx].sum(1),[.025,.975]).tolist()
    else: ci = [None,None]
    def scores(g):
        v = g.scoreDelta
        return {'horses':len(g), 'meanSignedDelta':float(v.mean()) if len(g) else None,
                'meanAbsDelta':float(v.abs().mean()) if len(g) else None,
                'medianAbsDelta':float(v.abs().median()) if len(g) else None,
                'p95AbsDelta':float(v.abs().quantile(.95)) if len(g) else None,
                'maxAbsDelta':float(v.abs().max()) if len(g) else None,
                'rankChanges':int((g.withRank!=g.withoutRank).sum())}
    result = {'all':group(r), 'debut':group(debut), 'allScores':scores(h), 'debutScores':scores(dh),
              'debutHorses':len(dh), 'days':daily, 'pairedDateBootstrap95':ci,
              'improvedDays':sum(d['meanHitChange']>0 for d in valid_days),
              'worseDays':sum(d['meanHitChange']<0 for d in valid_days),
              'unchangedDays':sum(d['meanHitChange']==0 for d in valid_days)}
    for b in ['with','without']:
        rate = result['debut'][b+'DebutHitRate']
        result['debut'][b+'DebutRecall'] = result['debut'][b+'DebutHits']/int(dh.finishing_position.between(1,4).sum()) if dh.finishing_position.between(1,4).any() else None
    a=result['debut']['withDebutHitRate']; b=result['debut']['withoutDebutHitRate']
    result['debut']['debutHitRateChangePp'] = 100*(a-b) if a is not None and b is not None else None
    return result

def run(a):
    out=Path(a.out); out.mkdir(parents=True,exist_ok=True)
    m,daily=load_helpers()
    df=pd.read_csv(a.input).sort_values(['race_date','race_id','horse_id']).reset_index(drop=True)
    ctx=pd.DataFrame(json.loads(Path(a.context).read_text()))
    if ctx.duplicated(['race_id','horse_id']).any(): raise ValueError('Duplicate context')
    ctx['servingElo']=[seed.js_round_tenth(seed.meeting_composite(r.horse,r.jockey,r.trainer,r.confidence,r.rating,r.race_class)['composite']) for r in ctx.itertuples()]
    ctx['eloSource']=[seed.meeting_composite(r.horse,r.jockey,r.trainer,r.confidence,r.rating,r.race_class)['source'] for r in ctx.itertuples()]
    df=df.merge(ctx[['race_id','horse_id','servingElo','eloSource','horse_number','scraped_at','source_commit','rating','confidence']],how='left',on=['race_id','horse_id'],validate='one_to_one')
    first={r['horse_id']:r['first_date'] for r in json.loads(Path(a.first_start).read_text())}
    df['first_starter']=[first.get(h)==d and d>'2016-09-03' for h,d in zip(df.horse_id,df.race_date)]
    df['servingBaseline']=df.servingElo+df.factor_bonus
    complete=set(rid for rid,g in df[df.servingElo.notna()].groupby('race_id') if complete_field(g))
    params={'objective':'lambdarank','metric':'None','lambdarank_truncation_level':4,'label_gain':[0,1,7,31]+[127]*16,
            'learning_rate':.01,'num_leaves':8,'min_data_in_leaf':20,'verbosity':-1,'num_threads':2,'seed':42,'deterministic':True,'force_col_wise':True}
    def dataset(frame,cols):
        return lgb.Dataset(frame[cols].fillna(-1).to_numpy(),label=m.make_graded_label(frame),group=frame.groupby('race_id',sort=False).size().to_numpy(),feature_name=cols)
    for day in a.dates.split(','):
        if not day or (out/f'{day}.json').exists(): continue
        past,train,val=daily.split_before(df,day)
        val=val[val.race_id.isin(complete)].copy(); target=df[(df.race_date==day)&df.race_id.isin(complete)].copy()
        if val.race_id.nunique()<20 or target.empty:
            (out/f'{day}.json').write_text(json.dumps({'date':day,'skipped':'Less than 20 complete prior validation races or no complete target','races':[]}));continue
        assert train.race_date.max()<val.race_date.min()<=val.race_date.max()<day
        ids=val.race_id.to_numpy(); labels=val.is_top1.to_numpy(); tids=target.race_id.to_numpy()
        base=m.standardize_per_race(val.servingBaseline.to_numpy(),ids); tb=m.standardize_per_race(target.servingBaseline.to_numpy(),tids)
        tau_elo=m.fit_temperature(base,ids,labels)
        diag=ROOT/f'public/reports/repair-calibration-2026-10-18/{day}.json'
        if diag.exists(): rounds=json.loads(diag.read_text())['best_iteration']; rounds_source='saved paired daily rounds'
        else:
            def metric(raw,_):return 'logloss',daily.loss(m.per_race_softmax(raw,ids),labels,ids),False
            pilot=lgb.train(params,dataset(train,m.FEAT_COLS),num_boost_round=2000,valid_sets=[dataset(val,m.FEAT_COLS)],feval=metric,callbacks=[lgb.early_stopping(80,verbose=False)])
            rounds=pilot.best_iteration; rounds_source='with-pedigree earlier-date validation; shared by both branches'
        cal={}
        for b,cols in [('with',m.FEAT_COLS),('without',[c for c in m.FEAT_COLS if c not in PEDIGREE_FEATURES])]:
            model=lgb.train(params,dataset(train,cols),num_boost_round=rounds)
            model.save_model(str(out/f'{day}-{b}-calibration-model.txt'))
            raw=model.predict(val[cols].fillna(-1).to_numpy(),num_threads=2)
            tl=m.fit_temperature(raw,ids,labels); pl=m.per_race_softmax(raw,ids,tl); pe=m.per_race_softmax(base,ids,tau_elo)
            alpha=m.fit_alpha(pl,pe,ids,labels)
            final=lgb.train(params,dataset(past,cols),num_boost_round=rounds); path=out/f'{day}-{b}-model.txt';final.save_model(str(path))
            traw=final.predict(target[cols].fillna(-1).to_numpy(),num_threads=2)
            p=alpha*m.per_race_softmax(traw,tids,tl)+(1-alpha)*m.per_race_softmax(tb,tids,tau_elo)
            target[b+'Logp']=np.log(np.maximum(p,1e-12));target[b+'Raw']=traw
            cal[b]={'features':len(cols),'rounds':rounds,'tauLgb':tl,'tauElo':tau_elo,'innerAlpha':alpha,'validationLogloss':daily.loss(alpha*pl+(1-alpha)*pe,labels,ids),'modelSha256':hashlib.sha256(path.read_bytes()).hexdigest()}
        races=[]; horses=[]
        for rid,g in target.groupby('race_id',sort=False):
            if not complete_field(g):raise ValueError('Incomplete target field')
            g=g.sort_values('horse_number').copy()
            for b in ['with','without']:
                g[b+'Score'],rs=score_field(g[b+'Logp'],g.servingElo,g.factor_bonus)
                g[b+'Rank']=pd.Series(rs,index=g.index).rank(ascending=False,method='first').astype(int)
            win=g.finishing_position.between(1,4); debut=g.first_starter
            rec={'date':day,'raceId':rid,'runners':len(g),'firstStarters':int(debut.sum()),'top4Changed':set(g[g.withRank<=4].horse_id)!=set(g[g.withoutRank<=4].horse_id)}
            for b in ['with','without']:
                pick=g[b+'Rank']<=4
                rec[b+'Hits']=int((pick&win).sum());rec[b+'DebutSelected']=int((pick&debut).sum());rec[b+'DebutHits']=int((pick&debut&win).sum())
            races.append(rec);g['scoreDelta']=g.withScore-g.withoutScore
            horses.extend(g[['race_date','race_id','horse_id','horse_number','first_starter','finishing_position','servingElo','eloSource','rating','confidence','scraped_at','source_commit','withRaw','withoutRaw','withLogp','withoutLogp','withScore','withoutScore','scoreDelta','withRank','withoutRank']].to_dict('records'))
        pd.DataFrame(horses).to_csv(out/f'{day}-horses.csv',index=False)
        record={'date':day,'trainingStart':past.race_date.min(),'trainingEnd':past.race_date.max(),'validationStart':val.race_date.min(),'validationEnd':val.race_date.max(),'validationRaces':int(val.race_id.nunique()),'trainRows':len(train),'refitRows':len(past),'roundsSource':rounds_source,'calibration':cal,'races':races,'excludedTargetRaces':sorted(set(df[df.race_date==day].race_id)-set(target.race_id))}
        (out/f'{day}.json').write_text(json.dumps(record,indent=2,allow_nan=False));print('Completed',day,len(races),'debut',sum(r['firstStarters'] for r in races),flush=True)

def summarize(a):
    out=Path(a.out); records=[json.loads(p.read_text()) for p in sorted(out.glob('2026-??-??.json'))]
    races=[r for d in records for r in d['races']]
    horses=pd.concat([pd.read_csv(p) for p in sorted(out.glob('2026-??-??-horses.csv'))],ignore_index=True)
    if horses.duplicated(['race_id','horse_id']).any():raise ValueError('Duplicate report horse rows')
    result=metrics(races,horses.to_dict('records'))
    result.update({'status':'EXPLORATORY_IMPROVEMENT_NOT_WEIGHT_APPROVAL','scope':'FULL_FIELD_SEED_AWARE_RESEARCH_FORMULA','productionPromoted':False,'frozenWrites':False,'pedigreeWeightChanged':False,'evaluatedDates':len(set(r['date'] for r in races)),'attemptedDates':len(records),'skippedDates':[d for d in records if d.get('skipped')],'calibrationDays':[{k:v for k,v in d.items() if k!='races'} for d in records if not d.get('skipped')],
        'limitations':['本地初出＝完整本地賽果庫首次出賽，不等於海外首戰或全部真初出；沒有進口履歷時不可混稱。','賽前排位評分有source_commit；scraped_at可能是同日或賽後刷新，並非不可變T−90原始副本。','Elo／可信度取目前資料庫重建的賽日前v12快照，不是當年實際凍結值；無v12快照按正式rating/class seed處理。','其他49項特徵及factor_bonus沿用原研究重建，不證明正式會期因子逐項完全一致。','52／49移除三項血統是有無對照，並非提高血統權重實驗；不能據此推定加重有效。','輪數固定兩分支一致；新增日期輪數由有血統較早驗證集挑選，可能偏向有血統分支。','逐日獨立校準：訓練<驗證<目標日；refit可用全部較早驗證日，目標日從不入訓練／校準。','血統身份是現存官方來源，不是逐日歷史採集快照；嚴格較早日期成績和平滑K=40，fallback=0.30。','全場四揀平均命中主指標；入選初出馬命中率＝初出馬頭四命中／所選初出馬，不是頭馬率。','研究報告不等於正式發布研究閘PASS，不更改模型、凍結、副本或歷史戰績。']})
    result['inputSha256']=hashlib.sha256(Path(a.input).read_bytes()).hexdigest();result['contextSha256']=hashlib.sha256(Path(a.context).read_bytes()).hexdigest()
    race_frame=pd.DataFrame(races)
    result['periods']=[]
    for label,mask in [('2026-05至07',race_frame.date<'2026-09-01'),('2026-09至10',race_frame.date>='2026-09-01')]:
        part=race_frame[mask]; ids=set(part.raceId)
        sub=metrics(part.to_dict('records'),horses[horses.race_id.isin(ids)].to_dict('records'))
        result['periods'].append({'period':label,**sub['debut'],'debutHorses':sub['debutHorses']})
    race_frame.to_csv(out/'races.csv',index=False);horses.to_csv(out/'horses.csv',index=False);horses[horses.first_starter].to_csv(out/'debut-horses.csv',index=False)
    (out/'summary.json').write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False));print(json.dumps({k:v for k,v in result.items() if k not in ['days','calibrationDays','limitations']},ensure_ascii=False,indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--input',required=True);p.add_argument('--context',required=True);p.add_argument('--first-start');p.add_argument('--out',required=True);p.add_argument('--dates',default='');p.add_argument('--summarize',action='store_true');a=p.parse_args()
    summarize(a) if a.summarize else run(a)