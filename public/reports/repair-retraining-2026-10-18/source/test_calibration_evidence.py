"""Validate saved offline evidence; never connect to production."""
import json, unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]/'repair-calibration-2026-10-18'

class EvidenceTests(unittest.TestCase):
    def test_cohort_complete(self):
        s=json.loads((ROOT/'summary.json').read_text())
        self.assertEqual(s['sourceCohortIncluded'],134)
        self.assertEqual(s['rows'],102252)

    def test_every_day_strictly_past(self):
        days=list(ROOT.glob('2026-*.json'))
        self.assertEqual(len(days),11)
        for p in days:
            d=json.loads(p.read_text())
            self.assertLess(d['train_end'],d['validation_start'])
            self.assertLess(d['validation_end'],d['date'])
            self.assertLess(d['refit_end'],d['date'])

    def test_candidate_does_not_promote_or_write_frozen(self):
        s=json.loads((ROOT/'summary.json').read_text())
        self.assertFalse(s['productionPromoted'])
        self.assertFalse(s['frozenWrites'])
        self.assertEqual(s['promotionGate'],'BLOCKED')
        self.assertLess(s['candidateMean'],s['marketMean'])

if __name__=='__main__': unittest.main()