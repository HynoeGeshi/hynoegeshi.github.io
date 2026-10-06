from __future__ import annotations

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://hynoeflicks.com"
PAGES = [
    "index.html",
    "booking.html",
    "nightlife-photographer-chicago.html",
    "portrait-photographer-chicago.html",
    "event-photographer-chicago.html",
    "music-photographer-chicago.html",
    "brand-photographer-chicago.html",
    "photo-editing-retouching.html",
]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class SiteStructureTests(unittest.TestCase):
    def test_required_pages_exist(self):
        for page in PAGES:
            with self.subTest(page=page):
                self.assertTrue((ROOT / page).exists(), page)

    def test_each_page_has_one_h1_and_custom_domain_canonical(self):
        for page in PAGES:
            path = ROOT / page
            if not path.exists():
                continue
            html = path.read_text(encoding="utf-8")
            h1s = re.findall(r"<h1\b", html, flags=re.I)
            self.assertEqual(len(h1s), 1, f"{page}: expected exactly one H1")
            canonical = re.search(r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)', html, flags=re.I)
            self.assertIsNotNone(canonical, f"{page}: missing canonical")
            self.assertTrue(canonical.group(1).startswith(DOMAIN), f"{page}: wrong canonical")

    def test_no_github_pages_hostname_in_production_metadata(self):
        for page in PAGES:
            path = ROOT / page
            if path.exists():
                self.assertNotIn("hynoegeshi.github.io", path.read_text(encoding="utf-8").lower(), page)

    def test_robots_and_sitemap_use_custom_domain(self):
        robots = text("robots.txt")
        sitemap = text("sitemap.xml")
        self.assertIn(f"Sitemap: {DOMAIN}/sitemap.xml", robots)
        self.assertNotIn("hynoegeshi.github.io", robots)
        self.assertNotIn("hynoegeshi.github.io", sitemap)
        for page in PAGES:
            expected = f"{DOMAIN}/" if page == "index.html" else f"{DOMAIN}/{page}"
            self.assertIn(expected, sitemap, page)


if __name__ == "__main__":
    unittest.main()
