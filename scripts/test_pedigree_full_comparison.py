import unittest
import numpy as np
from pedigree_full_comparison import score_field, metrics

class ComparisonContract(unittest.TestCase):
    def test_production_score_has_no_factor_added(self):
        score, ranking = score_field([0,0,0,0],[1500]*4,[20,0,0,0])
        np.testing.assert_array_equal(score,[1500]*4)
        self.assertAlmostEqual(ranking[0],.1)

    def test_full_field_sample_standard_deviation(self):
        score,_=score_field([1,2,3,4],[1500]*4,[0]*4)
        np.testing.assert_array_equal(score,[1397.8,1465.9,1534.1,1602.2])

    def test_nonfinite_field_rejected(self):
        with self.assertRaises(ValueError):score_field([1,float('nan'),3,4],[1500]*4,[0]*4)

    def test_hit_rate_uses_four_picks_and_debut_selection_denominators(self):
        races=[{'date':'2026-10-14','firstStarters':2,'withHits':3,'withoutHits':2,'withDebutSelected':2,'withoutDebutSelected':1,'withDebutHits':1,'withoutDebutHits':0,'top4Changed':True}]
        horses=[{'first_starter':True,'finishing_position':2,'scoreDelta':10,'withRank':2,'withoutRank':6},{'first_starter':True,'finishing_position':7,'scoreDelta':-2,'withRank':3,'withoutRank':3}]
        r=metrics(races,horses)
        self.assertEqual(r['debut']['withMeanHits'],3)
        self.assertEqual(r['debut']['withPickHitRate'],.75)
        self.assertEqual(r['debut']['pickHitRateChangePp'],25)
        self.assertEqual(r['debut']['withDebutHitRate'],.5)
        self.assertEqual(r['debut']['debutHitRateChangePp'],50)
        self.assertEqual(r['debutScores']['meanAbsDelta'],6)

if __name__=='__main__':unittest.main()