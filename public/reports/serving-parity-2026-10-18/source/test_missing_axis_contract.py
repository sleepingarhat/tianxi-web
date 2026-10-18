import hashlib
import gzip
import itertools
import os
import unittest
from pathlib import Path
import numpy as np
import pandas as pd
from missing_axis_contract import available_composite, calibration_baseline, serving_elo_z

ROOT = Path(__file__).resolve().parents[4]

class MissingAxisContractTests(unittest.TestCase):
    def test_all_eight_availability_masks(self):
        ratings = np.array([1500., 1600., 1400.])
        weights = np.array([.7, .2, .1])
        for mask in itertools.product([False, True], repeat=3):
            with self.subTest(mask=mask):
                mask = np.array(mask)
                actual = available_composite([np.where(mask, ratings, np.nan)])[0]
                if mask.any():
                    self.assertAlmostEqual(actual, (ratings[mask]*weights[mask]).sum()/weights[mask].sum())
                else:
                    self.assertTrue(np.isnan(actual))

    def test_all_missing_calibration_is_legacy_zero_not_factor_or_elo(self):
        baseline, missing = calibration_baseline([[np.nan]*3], [7.5])
        self.assertEqual(baseline[0], 0)
        self.assertTrue(missing[0])
        self.assertTrue(np.isnan(available_composite([[np.nan]*3])[0]))

    def test_serving_missing_composite_is_neutral_not_zero_rating(self):
        actual = serving_elo_z([1500, 1600, np.nan])
        np.testing.assert_allclose(actual, [-1/np.sqrt(2), 1/np.sqrt(2), 0])

    def test_single_or_constant_field_is_stable(self):
        np.testing.assert_array_equal(serving_elo_z([1500, 1500, np.nan]), [0, 0, 0])
        np.testing.assert_array_equal(serving_elo_z([np.nan]), [0])

    def test_infinity_is_rejected_not_imputed(self):
        with self.assertRaises(ValueError):
            available_composite([[np.inf, 1500, 1500]])

    def test_exact_39_keys_from_verified_complete_input(self):
        path = os.environ.get('TIANXI_COMPLETE_INPUT')
        self.assertIsNotNone(path, 'Provide the verified complete CSV to run this evidence test')
        with gzip.open(path, 'rb') as f:
            self.assertEqual(hashlib.sha256(f.read()).hexdigest(), '5d56049e6acbc419db783c2827ae25095a413c42016e4f389e55a99055053dcf')
        frame = pd.read_csv(path)
        baseline, missing = calibration_baseline(frame[['h_elo','j_elo','t_elo']], frame.factor_bonus)
        self.assertEqual(int(missing.sum()), 39)
        self.assertEqual(frame.loc[missing].race_id.nunique(), 28)
        fixture = pd.read_csv(ROOT/'public/reports/serving-parity-2026-10-18/missing-axis-39.csv')
        self.assertEqual(set(zip(frame.loc[missing].race_id,frame.loc[missing].horse_id)), set(zip(fixture.race_id,fixture.horse_id)))
        np.testing.assert_array_equal(baseline[missing], np.zeros(39))
        self.assertTrue(np.isfinite(baseline).all())

if __name__ == '__main__':
    unittest.main()