import unittest
from worker import Segment, build_candidates


class CandidateScoringTests(unittest.TestCase):
    def test_high_energy_moment_beats_plain_speech(self):
        segments = [
            Segment(0, 5, "we are walking back to the base"),
            Segment(8, 13, "bro no way this is legendary let's go!"),
            Segment(14, 19, "I finally found the rare drop!"),
            Segment(30, 35, "we can sort the inventory now"),
        ]
        candidates = build_candidates(segments)
        self.assertTrue(candidates)
        self.assertGreaterEqual(candidates[0].score, 60)
        self.assertIn(candidates[0].category, {"rare_discovery", "funny_reaction", "progression"})

    def test_overlapping_candidates_are_deduplicated(self):
        segments = [
            Segment(0, 4, "bro no way!"),
            Segment(4, 8, "this is crazy!"),
            Segment(8, 12, "let's go legendary drop!"),
            Segment(12, 16, "I finally got it!"),
        ]
        candidates = build_candidates(segments)
        self.assertLessEqual(len(candidates), 2)


if __name__ == "__main__":
    unittest.main()
