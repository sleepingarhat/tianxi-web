"""Offline pedigree contract. No network or writes to prediction stores."""
from collections import defaultdict
import math

PEDIGREE_FEATURES = ["sire_top3_sm", "sire_dist_top3_sm", "damsire_top3_sm"]

def smooth(starts, hits, prior, strength=40):
    if starts < hits or hits < 0 or not 0 <= prior <= 1:
        raise ValueError("Invalid progeny counts/prior")
    return math.floor(((hits + strength * prior) / (starts + strength)) * 10000 + .5) / 10000

def pedigree_features(rows, aggregates, pedigree):
    """All rows on a meeting date see the same strictly earlier-date evidence."""
    by_date = defaultdict(list)
    targets = defaultdict(list)
    for r in rows: targets[r['race_date']].append(r)
    for r in aggregates: by_date[r["race_date"]].append(r)
    source_dates = sorted(by_date)
    cursor = 0
    overall = [0, 0]
    sire, damsire, dist = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    outputs, priors = {}, {}
    for date in sorted(set(r["race_date"] for r in rows)):
        while cursor < len(source_dates) and source_dates[cursor] < date:
            for r in by_date[source_dates[cursor]]:
                n, hit = r["starts"], r["top3"]
                overall[0] += n; overall[1] += hit
                for key, store in [(r.get("sire"), sire), (r.get("damsire"), damsire),
                                   ((r.get("sire"), r["distance"]), dist)]:
                    if key and (not isinstance(key, tuple) or key[0]):
                        store[key][0] += n; store[key][1] += hit
            cursor += 1
        prior = overall[1] / overall[0] if overall[0] else .30
        priors[date] = {"prior": prior, "starts": overall[0], "top3": overall[1]}
        local_cache = {}
        for r in targets[date]:
            p = pedigree.get(r["horse_id"], {})
            s, ds = p.get("sire"), p.get("damsire")
            cache_key = (s, r['distance'])
            local = local_cache.get(cache_key)
            if local is None:
                local = [0, 0]
            if s and cache_key not in local_cache:
                for (name, distance), count in dist.items():
                    if name == s and distance is not None and abs(distance - r["distance"]) <= 200:
                        local[0] += count[0]; local[1] += count[1]
                local_cache[cache_key] = local
            outputs[(r["race_id"], r["horse_id"])] = [
                smooth(*sire[s], prior) if s else None,
                smooth(*local, prior) if s else None,
                smooth(*damsire[ds], prior) if ds else None,
            ]
    return outputs, priors