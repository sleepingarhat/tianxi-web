"""Read-only research reproduction of official meeting Elo; never backfills axes."""
import math
import re

CONTRACT_VERSION = "meeting-seed-confidence-v1"

def class_baseline(value):
    s = str(value or "")
    for pattern, rating in [(r"Group\s*1|G1|一級|第一班",105),
                            (r"Group\s*2|G2|二級|第二班",95),
                            (r"Group\s*3|G3|三級|第三班",85),
                            (r"Griffin|新馬",52),
                            (r"第四班|Class\s*4",55),
                            (r"第五班|Class\s*5",45)]:
        if re.search(pattern, s, re.I):
            return rating
    match = re.search(r"[1-5]", s)
    return {"1":85,"2":75,"3":65,"4":55,"5":45}.get(match[0],52) if match else 52

def finite_or_missing(value):
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    if not math.isfinite(float(value)):
        raise ValueError("Non-finite Elo/confidence")
    return float(value)

def seed_horse(rating, race_class):
    # Match JS parseInt for strings, including numeric prefixes.
    if isinstance(rating, str):
        match = re.match(r"^[+-]?\d+", rating.strip())
        rating = int(match[0]) if match else None
    elif rating is not None:
        rating = finite_or_missing(rating)
    if rating is not None and rating > 0:
        return 1500 + (rating - 60) * 8, "rating-seed", .4
    return 1500 + (class_baseline(race_class) - 60) * 8, "class-seed", .2

def meeting_composite(horse, jockey, trainer, confidence, rating, race_class,
                      weights=(.7,.2,.1)):
    horse, jockey, trainer = map(finite_or_missing, (horse,jockey,trainer))
    confidence = finite_or_missing(confidence)
    if confidence is not None and not 0 <= confidence <= 1:
        raise ValueError("Confidence outside [0,1]")
    if horse is None:
        effective_horse, source, conf = seed_horse(rating,race_class)
    else:
        effective_horse, source, conf = horse, "snapshot", confidence if confidence is not None else 1
    effective_weights = (weights[0]*conf, weights[1], weights[2])
    parts = [(v,w) for v,w in zip((effective_horse,jockey,trainer),effective_weights) if v is not None]
    denominator = sum(w for _,w in parts)
    composite = sum(v*w for v,w in parts)/denominator if denominator > 0 else None
    return {"composite":composite,"seededHorse":effective_horse,"source":source,"confidenceFactor":conf}

def js_round_tenth(value):
    return math.floor(value*10+.5)/10 if value is not None else None