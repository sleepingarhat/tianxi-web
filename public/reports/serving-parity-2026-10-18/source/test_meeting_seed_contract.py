import unittest
from meeting_seed_contract import meeting_composite, seed_horse, class_baseline

class MeetingSeedContractTests(unittest.TestCase):
    def test_rating_52_is_1436_with_point_four_confidence(self):
        self.assertEqual(seed_horse(52,None),(1436,"rating-seed",.4))

    def test_missing_rating_uses_class_four_1460_point_two(self):
        self.assertEqual(seed_horse(None,"Class 4"),(1460,"class-seed",.2))

    def test_rating_seed_weight_is_point_28_not_point_7(self):
        result=meeting_composite(None,1600,1400,None,52,None)
        self.assertAlmostEqual(result["composite"],(1436*.28+1600*.2+1400*.1)/.58)

    def test_snapshot_confidence_zero_removes_horse_weight(self):
        result=meeting_composite(1500,1600,1400,0,None,None)
        self.assertAlmostEqual(result["composite"],(1600*.2+1400*.1)/.3)

    def test_snapshot_missing_confidence_uses_one(self):
        self.assertEqual(meeting_composite(1500,1600,1400,None,None,None)["composite"],1510)

    def test_all_raw_axes_missing_seeds_without_changing_input(self):
        axes=[None,None,None]
        self.assertEqual(meeting_composite(*axes,None,None,None)["composite"],1436)
        self.assertEqual(axes,[None,None,None])

    def test_zero_confidence_without_other_axes_remains_missing(self):
        self.assertIsNone(meeting_composite(1500,None,None,0,None,None)["composite"])

    def test_infinite_axis_rejected(self):
        with self.assertRaises(ValueError):
            meeting_composite(float("inf"),None,None,None,None,None)

    def test_class_precedence_preserved(self):
        self.assertEqual(class_baseline("第一班"),105)
        self.assertEqual(class_baseline("Class 1"),85)

if __name__ == "__main__":
    unittest.main()