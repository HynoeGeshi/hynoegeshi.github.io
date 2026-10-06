from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from PIL import Image

from scripts.optimize_portfolio import build_derivatives, save_webp_under_budget


class ImagePipelineTests(unittest.TestCase):
    def test_build_derivatives_creates_bounded_variants(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source = root / "source.jpg"
            Image.new("RGB", (2400, 1600), "#654321").save(source, quality=95)
            result = build_derivatives(source, root / "out", "sample")
            for key in ("thumb", "card", "large", "thumbJpeg", "cardJpeg", "largeJpeg"):
                self.assertTrue((root / "out" / result[key]).exists(), key)
            with Image.open(root / "out" / result["thumb"]) as img:
                self.assertLessEqual(img.width, 640)
            with Image.open(root / "out" / result["card"]) as img:
                self.assertLessEqual(img.width, 1280)
            with Image.open(root / "out" / result["large"]) as img:
                self.assertLessEqual(img.width, 2200)
            self.assertNotIn("original", result["thumb"].lower())

    def test_webp_encoder_adapts_quality_to_fit_budget(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "noisy.webp"
            noisy = Image.effect_noise((1500, 1000), 85).convert("RGB")
            quality = save_webp_under_budget(noisy, target, start_quality=84, max_bytes=800_000)
            self.assertTrue(target.exists())
            self.assertLessEqual(target.stat().st_size, 800_000)
            self.assertLess(quality, 84)


if __name__ == "__main__":
    unittest.main()
