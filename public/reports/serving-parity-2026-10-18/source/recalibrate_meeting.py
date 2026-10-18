"""Date-held-out seed-aware calibration. Offline only; does not authorize release."""
import argparse
import importlib.util
import json
import sys
import types
from pathlib import Path
import numpy as np
import pandas as pd
import lightgbm as lgb
from meeting_seed_contract import meeting_composite, js_round_tenth

def run(args):
    root=Path(args.root); out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    spec=importlib.util.spec_from_file_location("prediction",root/"public/reports/repair-retraining-2026-10-18/source/predict_upcoming.py")
    prediction=importlib.util.module_from_spec(spec);spec.loader.exec_module(prediction)
    sys.modules["scripts"]=types.ModuleType("scripts");sys.modules["scripts.backtest"]=types.ModuleType("scripts.backtest")
    sys.modules["scripts.backtest.predict_upcoming"]=prediction
    spec=importlib.util.spec_from_file_location("daily",root/"public/reports/repair-calibration-2026-10-18/source/daily_calibration.py")
    daily=importlib.util.module_from_spec(spec);spec.loader.exec_module(daily)
    df=pd.read_csv(args.input).sort_values(["race_date","race_id"]).reset_index(drop=True)
    context=pd.read_csv(args.context)
    if context.duplicated(["race_id","horse_id"]).any():raise ValueError("Duplicate context keys")
    context["reproducedComposite"]=[js_round_tenth(meeting_composite(
        r.horse,r.jockey,r.trainer,r.confidence,r.rating,r.race_class)["composite"])
        for r in context.itertuples()]
    if not np.allclose(context.reproducedComposite,context.officialComposite,equal_nan=True):raise ValueError("Seed contract parity failed")
    complete=set()
    for rid,g in context.groupby("race_id"):
        original=df[df.race_id==rid]
        if len(original) and set(original.horse_id)==set(g.horse_id):complete.add(rid)
    joined=df.merge(context[["race_id","horse_id","reproducedComposite","factor"]],on=["race_id","horse_id"],how="left",validate="one_to_one")
    joined["servingBaseline"]=joined.reproducedComposite+joined.factor
    cohort=pd.read_csv(root/"public/reports/repair-calibration-2026-10-18/cohort-readback.csv")
    keys=set(zip(cohort.race_id,cohort.rebuilt_horse_id))
    removed=pd.Series([(r,h) in keys for r,h in zip(joined.race_id,joined.horse_id)])
    if removed.sum()!=134:raise ValueError("Expected exact 134-row cohort")
    params={"objective":"lambdarank","metric":"None","lambdarank_truncation_level":4,
        "label_gain":[0,1,7,31]+[127]*16,"learning_rate":.01,"num_leaves":8,
        "min_data_in_leaf":20,"verbosity":-1,"num_threads":2,"seed":42,"deterministic":True,"force_col_wise":True}
    outputs=[]; reports=[]
    for d in json.load(open(root/"src/lib/repair-calibration-summary.json"))["days"]:
        day=d["date"];past,train,val=daily.split_before(joined,day)
        excluded_validation=val.race_id.nunique()-val[val.race_id.isin(complete)].race_id.nunique()
        val=val[val.race_id.isin(complete)].copy();target=joined[(joined.race_date==day)&joined.race_id.isin(complete)].copy()
        if val.race_id.nunique()<20:raise ValueError("Insufficient complete validation races")
        if val.servingBaseline.isna().any() or target.servingBaseline.isna().any():raise ValueError("Missing seeded baseline")
        assert train.race_date.max()<val.race_date.min()<=val.race_date.max()<day
        rounds=json.load(open(root/f"public/reports/repair-calibration-2026-10-18/{day}.json"))["best_iteration"]
        ids=val.race_id.to_numpy();labels=val.is_top1.to_numpy()
        baseline=prediction.standardize_per_race(val.servingBaseline.to_numpy(),ids)
        tids=target.race_id.to_numpy();tb=prediction.standardize_per_race(target.servingBaseline.to_numpy(),tids)
        calibs={}
        for branch,remove in [("included",False),("excluded",True)]:
            fit=train[~removed.loc[train.index]] if remove else train
            dataset=lgb.Dataset(fit[prediction.FEAT_COLS].fillna(-1).to_numpy(),label=prediction.make_graded_label(fit),group=fit.groupby("race_id",sort=False).size().to_numpy())
            model=lgb.train(params,dataset,num_boost_round=rounds)
            raw=model.predict(val[prediction.FEAT_COLS].fillna(-1).to_numpy(),num_threads=2)
            tl=prediction.fit_temperature(raw,ids,labels);te=prediction.fit_temperature(baseline,ids,labels)
            pl=prediction.per_race_softmax(raw,ids,tl);pe=prediction.per_race_softmax(baseline,ids,te)
            alpha=prediction.fit_alpha(pl,pe,ids,labels)
            if remove:
                refit=lgb.Booster(model_file=str(root/f"public/reports/cohort-impact-2026-10-18/{day}-excluded-model.txt"))
                target_raw=refit.predict(target[prediction.FEAT_COLS].fillna(-1).to_numpy(),num_threads=2)
            else:
                saved=pd.read_csv(root/f"public/reports/repair-calibration-2026-10-18/{day}-predictions.csv")
                target_raw=target[["race_id","horse_id"]].merge(saved[["race_id","horse_id","raw_score"]],on=["race_id","horse_id"],validate="one_to_one").raw_score.to_numpy()
            probs=alpha*prediction.per_race_softmax(target_raw,tids,tl)+(1-alpha)*prediction.per_race_softmax(tb,tids,te)
            target[branch]=np.log(np.maximum(probs,1e-12))
            calibs[branch]={"tau_lgb":float(tl),"tau_elo":float(te),"inner_alpha":float(alpha),"validation_logloss":daily.loss(alpha*pl+(1-alpha)*pe,labels,ids)}
        record={"date":day,"train_end":train.race_date.max(),"validation_start":val.race_date.min(),"validation_end":val.race_date.max(),"validationRaces":int(val.race_id.nunique()),"excludedValidationRaces":int(excluded_validation),"targetRaces":int(target.race_id.nunique()),"rounds":int(rounds),"calibration":calibs}
        (out/f"{day}.json").write_text(json.dumps(record,indent=2));reports.append(record)
        for r in target.itertuples():outputs.append({"raceId":r.race_id,"horseId":r.horse_id,"date":day,"included":r.included,"excluded":r.excluded,"actualFinish":int(r.finishing_position)})
        print("Seed-aware calibration completed",day,record["validationRaces"],record["targetRaces"],flush=True)
    (out/"candidates.json").write_text(json.dumps(outputs,allow_nan=False))
    (out/"calibration.json").write_text(json.dumps({"days":reports,"productionWrites":0,"researchGate":"UNVERIFIED","promotion":"BLOCKED","limitation":"Only complete fields retained; raw 52 training features unchanged, seed contract applied to calibration baseline."},indent=2))

if __name__=="__main__":
    parser=argparse.ArgumentParser();parser.add_argument("--root",required=True);parser.add_argument("--input",required=True);parser.add_argument("--context",required=True);parser.add_argument("--out",required=True)
    run(parser.parse_args())