"""四揀失效分析＋場地分組＋冷門分歧（只讀研究，不寫預測、凍結或戰績）。

只讀 Worker 已鎖定命中紀錄（scoreSource 必須含 frozen）。
- 失效：四揀中 0–1 匹嘅場次，按原因分類（可多於一類）：
  爆冷＝實際前四有 ≥2 匹獨贏 ≥20 倍；退出＝四揀有效匹數 <4；
  場地＝場地狀況非「好地／好地至快地」；其餘＝未分類。
- 分組：場地（跑馬地／沙田）、途程組、場地狀況嘅平均中匹數。
- 冷門分歧：實際前四冷門馬數量 vs 中匹數，睇模型盲點係咪集中喺冷門。
用法：SITE_READER_TOKEN=... python3 scripts/top4_failure_analysis.py 2026-10-04 ...
"""
import json
import os
import sys
import urllib.request
from collections import defaultdict

BASE = "https://tianxi-backend.tianxi-entertainment.workers.dev/api/analyze/hit-rate?date="
LONGSHOT = 20.0
GOOD_GOING = {"好地", "好地至快地", "快地"}


def fetch(date):
    req = urllib.request.Request(BASE + date, headers={"X-Tianxi-Site-Token": os.environ.get("SITE_READER_TOKEN", ""), "User-Agent": "tianxi-research/1.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def dist_band(d):
    d = int(d or 0)
    return "短途≤1200" if d <= 1200 else ("中途1201–1650" if d <= 1650 else "長途>1650")


def classify(race):
    reasons = []
    actual = race.get("actualTop4") or []
    longshots = sum(1 for a in actual if (a.get("winOdds") or 0) >= LONGSHOT)
    if longshots >= 2:
        reasons.append("爆冷")
    if len(race.get("predictedTop4") or []) < 4 or race.get("top4Eligible", 4) < 4:
        reasons.append("退出")
    if race.get("going") and race["going"] not in GOOD_GOING:
        reasons.append("場地")
    return reasons or ["未分類"], longshots


def main(dates):
    rows = []
    for date in dates:
        day = fetch(date)
        for race in day.get("races") or []:
            n = race.get("top4IntersectCount")
            if n is None:
                continue
            if "frozen" not in str(race.get("scoreSource", "")):
                raise ValueError(f"{date} R{race.get('raceNumber')} 唔係凍結來源，拒絕計入")
            reasons, ls = classify(race)
            rows.append({"date": date, "race": race["raceNumber"], "venue": day.get("venue"), "going": race.get("going"),
                         "band": dist_band(race.get("distance")), "hits": int(n), "longshots": ls, "reasons": reasons})
    if not rows:
        raise SystemExit("冇凍結場次")

    def group(key):
        g = defaultdict(list)
        for r in rows:
            g[r[key]].append(r["hits"])
        return {k: {"races": len(v), "avgTop4Hits": round(sum(v) / len(v), 3)} for k, v in sorted(g.items(), key=lambda x: str(x[0]))}

    fails = [r for r in rows if r["hits"] <= 1]
    reason_count = defaultdict(int)
    for r in fails:
        for x in r["reasons"]:
            reason_count[x] += 1
    out = {
        "races": len(rows), "avgTop4Hits": round(sum(r["hits"] for r in rows) / len(rows), 3),
        "failures": {"count": len(fails), "share": round(len(fails) / len(rows), 3), "reasons": dict(reason_count),
                     "rows": fails},
        "byVenue": group("venue"), "byDistance": group("band"), "byGoing": group("going"), "byLongshotsInActualTop4": group("longshots"),
        "note": "只屬研究報告；樣本未達200場，只報方向，不作升版依據。",
    }
    print(json.dumps(out, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main(sys.argv[1:])
