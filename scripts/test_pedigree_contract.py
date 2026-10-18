import unittest
from pedigree_contract import pedigree_features, smooth

class PedigreeContractTest(unittest.TestCase):
    def test_small_samples_shrink_with_40(self):
        self.assertEqual(smooth(0, 0, .30), .30)
        self.assertEqual(smooth(10, 5, .30), .34)

    def test_same_day_and_future_never_enter_prior_or_progeny(self):
        rows = [{"race_date":"2026-10-18", "race_id":"r1", "horse_id":"h", "distance":1200}]
        past = {"race_date":"2026-10-17", "sire":"s", "damsire":"d", "distance":1200,"starts":10,"top3":2}
        future = {**past,"race_date":"2026-10-18","starts":100,"top3":100}
        p = {"h":{"sire":"s","damsire":"d"}}
        a, prior = pedigree_features(rows,[past],p)
        b, _ = pedigree_features(rows,[past,future,{**future,"race_date":"2026-10-19"}],p)
        self.assertEqual(a,b)
        self.assertEqual(prior["2026-10-18"]["starts"],10)
        self.assertEqual(a[("r1","h")],[.2,.2,.2])

    def test_unknown_not_low_performance(self):
        r = {"race_date":"2026-10-18", "race_id":"r1", "horse_id":"h", "distance":1200}
        result, _ = pedigree_features([r],[],{})
        self.assertEqual(result[("r1","h")],[None,None,None])

    def test_missing_distance_keeps_general_stats_not_distance_match(self):
        r = {"race_date":"2026-10-18", "race_id":"r1", "horse_id":"h", "distance":1200}
        past = {"race_date":"2026-10-17", "sire":"s", "damsire":"d", "distance":None,"starts":10,"top3":5}
        other = {**past,"sire":"other","damsire":"other","distance":1600,"top3":0}
        result, _ = pedigree_features([r],[past,other],{"h":{"sire":"s","damsire":"d"}})
        self.assertEqual(result[("r1","h")],[.3,.25,.3])

if __name__ == "__main__": unittest.main()