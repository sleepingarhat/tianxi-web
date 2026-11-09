"""逐賽日四揀平均中匹數累積報告（主指標，目標 3／4）。

只讀 Worker 已鎖定命中紀錄；唔寫預測、凍結、副本或戰績。
分母按每場 top4Eligible（鎖後退出不補位，分母仍為 4）。
用法：SITE_READER_TOKEN=... python3 scripts/kpi_daily_calibration.py 2026-10-04 2026-10-07 ...
"""
import json
import os
import random
import sys
import urllib.request

BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev/api/analyze/hit-rate?date="
TARGET = 3.0
MIN_RACES_FOR_JUDGEMENT = 200  # 少於此場數只報告方向，不判斷改動有效


def fetch(date):
    req = urllib.request.Request(BASE + date, headers={"X-Tianxi-Site-Token": os.environ.get("SITE_READER_TOKEN", ""), "User-Agent": "tianxi-research/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def race_rows(day):
    rows = []
    for race in day.get("races") or []:
        n = race.get("top4IntersectCount")
        if n is None:
            continue
        if not str(race.get("scoreSource", "")).find("frozen") >= 0:
            raise ValueError(f"{day['date']} R{race.get('raceNumber')} 唔係凍結來源，拒絕計入")
        rows.append({"date": day["date"], "race": race["raceNumber"], "hits": int(n)})
    return rows


def bootstrap_ci(values, iters=4000, seed=20261104):
    rnd = random.Random(seed)
    means = sorted(sum(rnd.choice(values) for _ in values) / len(values) for _ in range(iters))
    return means[int(iters * 0.025)], means[int(iters * 0.975)]


def summarise(rows):
    vals = [r["hits"] for r in rows]
    lo, hi = bootstrap_ci(vals)
    return {"races": len(vals), "avgTop4Hits": round(sum(vals) / len(vals), 3), "ci95": [round(lo, 3), round(hi, 3)],
            "target": TARGET, "enoughSample": len(vals) >= MIN_RACES_FOR_JUDGEMENT}


def main(dates):
    out, all_rows = [], []
    for d in dates:
        rows = race_rows(fetch(d))
        if not rows:
            out.append({"date": d, "status": "no-frozen-results"})
            continue
        all_rows += rows
        out.append({"date": d, **summarise(rows), "cumulative": summarise(all_rows)})
    print(json.dumps({"days": out, "overall": summarise(all_rows) if all_rows else None}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
