import unittest
import clip_quality as cq
from clip_quality import Segment, Candidate, build_candidates, caption_cues, make_title, select_diverse


class ClipQualityTests(unittest.TestCase):
    def test_rejects_stream_admin_chatter_even_with_exciting_keywords(self):
        segments = [
            Segment(0, 7, "That might be a good stopping point to switch over to Minecraft."),
            Segment(7, 14, "We might stop it there because we just finished up the big old boss fight."),
            Segment(14, 22, "That's chapter two part three. What y'all say? Let's give it another go."),
            Segment(22, 28, "Come on man let's go. No big guy death immediately."),
        ]
        self.assertEqual(build_candidates(segments, max_clips=8), [])

    def test_rejects_npc_dialogue_without_gameplay_event_or_streamer_payoff(self):
        segments = [
            Segment(0, 7, "Stay loose. The detail. What's going on girl? Ain't no way."),
            Segment(7, 14, "Oh my goodness. I'm definitely not a sugar cookie."),
            Segment(14, 22, "Vintage. I mean you look great for your age."),
            Segment(22, 28, "Why don't you come talk when your balls drop."),
        ]
        self.assertEqual(build_candidates(segments, max_clips=8), [])

    def test_accepts_setup_event_and_payoff_as_a_ministory(self):
        segments = [
            Segment(0, 4, "Okay this big guy keeps rushing me."),
            Segment(4, 8, "I'm gonna bait him around this corner and try one more time."),
            Segment(8, 12, "Oh no no no get away from me!"),
            Segment(12, 16, "I got him! Let's go!"),
            Segment(16, 21, "That was way too close, I thought I was dead."),
        ]
        clips = build_candidates(segments, max_clips=8)
        self.assertGreaterEqual(len(clips), 1)
        best = clips[0]
        self.assertGreaterEqual(best.score, 70)
        self.assertLessEqual(best.start, 4)
        self.assertGreaterEqual(best.end, 20)
        self.assertIn(best.category, {"boss_combat", "clutch_survival"})

    def test_far_stricter_duplicate_suppression(self):
        a = Candidate(100.0, 130.0, 92, "boss_combat", "run run boss down lets go", ["story"], "Boss Down")
        b = Candidate(120.0, 151.0, 89, "boss_combat", "boss down lets go that was close", ["story"], "Boss Down Again")
        c = Candidate(260.0, 292.0, 83, "funny_reaction", "my mouse stopped working during the sniper fight", ["story"], "Mouse Betrayed Me")
        selected = select_diverse([a, b, c], max_clips=8)
        self.assertEqual(selected, [a, c])

    def test_caption_chunks_are_short_and_timed(self):
        seg = Segment(10.0, 14.0, "oh my god my mouse picked the worst possible time to stop working")
        cues = caption_cues([seg], start=10.0, end=14.0, max_words=5)
        self.assertGreaterEqual(len(cues), 2)
        self.assertTrue(all(len(text.split()) <= 5 for _, _, text in cues))
        self.assertAlmostEqual(cues[0][0], 0.0, places=2)
        self.assertAlmostEqual(cues[-1][1], 4.0, places=2)

    def test_title_uses_actual_moment_not_generic_template(self):
        c = Candidate(
            0, 28, 84, "technical_fail",
            "run run run bro oh my god why am i having such bad problems with my mouse my mouse isn't doing what i tell it to do",
            ["story"], ""
        )
        title = make_title(c, "Gears of War: E-Day")
        self.assertIn("Mouse", title)
        self.assertNotIn("Nah This Was Crazy", title)

    def test_rejects_action_without_payoff(self):
        segments = [
            Segment(0, 4, "bro this enemy keeps rushing me"),
            Segment(4, 8, "fight fight run run get away"),
            Segment(8, 12, "enemy coming out grenade shot"),
            Segment(12, 20, "come on dude this is crazy"),
        ]
        self.assertEqual(build_candidates(segments, max_clips=8), [])

    def test_fallback_title_avoids_vague_reaction_phrase(self):
        c = Candidate(0, 24, 82, "gameplay_moment", "bro enemy coming out fight run dude this is crazy", ["real gameplay event"], "")
        title = make_title(c, "Gears of War: E-Day")
        self.assertNotIn("this is crazy", title.lower())
        self.assertNotIn("nah this was crazy", title.lower())

    def test_short_metadata_links_back_to_source(self):
        self.assertTrue(hasattr(cq, "build_short_metadata"), "build_short_metadata must exist")
        c = Candidate(0, 24, 88, "discovery", "bro no way I found a legendary drop let's go", ["reaction/payoff"], "")
        meta = cq.build_short_metadata(c, "Minecraft", "abc123")
        self.assertIn("https://www.youtube.com/watch?v=abc123", meta["description"])
        self.assertIn("Minecraft", meta["title"])
        self.assertIn("Shorts", meta["hashtags"])


if __name__ == '__main__':
    unittest.main()
