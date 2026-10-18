"""Compatibility contract, not authorization to promote or rewrite history."""
import numpy as np

WEIGHTS = np.array([0.7, 0.2, 0.1])
CONTRACT_VERSION = "available-axis-legacy-zero-v1"

def available_composite(axes):
    axes = np.asarray(axes, dtype=float)
    if axes.ndim != 2 or axes.shape[1] != 3:
        raise ValueError("Expected horse/jockey/trainer axes")
    if np.isinf(axes).any():
        raise ValueError("Infinite Elo is invalid, not missing")
    finite = np.isfinite(axes)
    denominator = (finite * WEIGHTS).sum(axis=1)
    numerator = (np.where(finite, axes, 0) * WEIGHTS).sum(axis=1)
    return np.divide(numerator, denominator, out=np.full(len(axes), np.nan), where=denominator > 0)

def calibration_baseline(axes, factors):
    composite = available_composite(axes)
    factors = np.asarray(factors, dtype=float)
    if factors.shape != composite.shape or not np.isfinite(factors).all():
        raise ValueError("Complete finite factors required")
    baseline = composite + factors
    missing = np.isnan(composite)
    # Exact compatibility with the saved calibrated-fusion replay's fillna(0).
    # Zero is an internal calibration sentinel, never an observed Elo rating.
    return np.where(missing, 0, baseline), missing

def serving_elo_z(composites):
    values = np.asarray(composites, dtype=float)
    if np.isinf(values).any():
        raise ValueError("Infinite composite")
    valid = values[np.isfinite(values)]
    mean = valid.mean() if len(valid) else 0
    sd = valid.std(ddof=1) if len(valid) > 1 else 1
    sd = sd if np.isfinite(sd) and sd > 0 else 1
    return np.where(np.isfinite(values), (values - mean) / sd, 0)