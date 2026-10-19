import importlib.util
import sys
import unittest
from pathlib import Path

class RepairParsingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        previous=sys.argv
        sys.argv=['collector']
        try:
            spec=importlib.util.spec_from_file_location('collector',Path(__file__).with_name('racing-targeted-repair.py'))
            cls.module=importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.module)
        finally:sys.argv=previous

    def test_horse_location_preserves_course(self):
        self.assertEqual(self.module.parse_zh_location('沙田草地"C+3"'),('沙田','草地','C+3'))

    def test_jockey_all_weather(self):
        self.assertEqual(self.module.parse_zh_location('全天候'),('','全天候',''))

    def test_unknown_location_not_invented(self):
        self.assertEqual(self.module.parse_zh_location('未知'),('未知','',''))

if __name__=='__main__':unittest.main()