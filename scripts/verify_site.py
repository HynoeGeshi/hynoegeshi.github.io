from __future__ import annotations

import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parents[1]
DOMAIN = "https://hynoeflicks.com"
PRODUCTION_PAGES = [
    "index.html",
    "booking.html",
    "nightlife-photographer-chicago.html",
    "portrait-photographer-chicago.html",
    "event-photographer-chicago.html",
    "music-photographer-chicago.html",
    "brand-photographer-chicago.html",
    "photo-editing-retouching.html",
]

@dataclass
class PageAudit:
    path: Path
    title: str
    description: str
    canonical: str
    h1_count: int
    og_title: str
    og_url: str
    og_image: str
    twitter_card: str
    json_ld_blocks: list[dict]


def _attr(html: str, pattern: str) -> str:
    match = re.search(pattern, html, flags=re.I | re.S)
    return match.group(1).strip() if match else ""


def discover_html_pages(root: Path) -> list[Path]:
    return [root / name for name in PRODUCTION_PAGES if (root / name).exists()]


def parse_page(path: Path) -> PageAudit:
    html = path.read_text(encoding="utf-8")
    title = _attr(html, r"<title>(.*?)</title>")
    description = _attr(html, r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)')
    canonical = _attr(html, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)')
    og_title = _attr(html, r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']*)')
    og_url = _attr(html, r'<meta[^>]+property=["\']og:url["\'][^>]+content=["\']([^"\']*)')
    og_image = _attr(html, r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']*)')
    twitter_card = _attr(html, r'<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\']([^"\']*)')
    blocks = []
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, flags=re.I | re.S):
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            blocks.append({"__invalid__": True})
    return PageAudit(
        path=path,
        title=title,
        description=description,
        canonical=canonical,
        h1_count=len(re.findall(r"<h1\b", html, flags=re.I)),
        og_title=og_title,
        og_url=og_url,
        og_image=og_image,
        twitter_card=twitter_card,
        json_ld_blocks=blocks,
    )


def audit_site(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    pages = discover_html_pages(root)
    missing = [name for name in PRODUCTION_PAGES if not (root / name).exists()]
    errors += [f"missing page: {name}" for name in missing]

    titles: set[str] = set()
    descriptions: set[str] = set()
    for path in pages:
        audit = parse_page(path)
        label = path.name
        if audit.h1_count != 1:
            errors.append(f"{label}: expected exactly one H1, found {audit.h1_count}")
        if not audit.title:
            errors.append(f"{label}: missing title")
        elif audit.title in titles:
            errors.append(f"{label}: duplicate title")
        titles.add(audit.title)
        if not audit.description:
            errors.append(f"{label}: missing description")
        elif audit.description in descriptions:
            errors.append(f"{label}: duplicate description")
        descriptions.add(audit.description)
        if not audit.canonical.startswith(DOMAIN):
            errors.append(f"{label}: invalid canonical")
        if audit.og_url and not audit.og_url.startswith(DOMAIN):
            errors.append(f"{label}: invalid og:url")
        if "hynoegeshi.github.io" in path.read_text(encoding="utf-8").lower():
            errors.append(f"{label}: GitHub Pages hostname leaked into production metadata")
        for block in audit.json_ld_blocks:
            if block.get("__invalid__"):
                errors.append(f"{label}: invalid JSON-LD")

    robots = root / "robots.txt"
    if robots.exists():
        value = robots.read_text(encoding="utf-8")
        if f"Sitemap: {DOMAIN}/sitemap.xml" not in value:
            errors.append("robots.txt: wrong sitemap URL")
    else:
        errors.append("missing robots.txt")

    sitemap = root / "sitemap.xml"
    if sitemap.exists():
        try:
            xml = ElementTree.parse(sitemap)
            locs = {el.text for el in xml.iter() if el.tag.endswith("loc")}
            for name in PRODUCTION_PAGES:
                url = f"{DOMAIN}/" if name == "index.html" else f"{DOMAIN}/{name}"
                if url not in locs:
                    errors.append(f"sitemap.xml: missing {url}")
        except ElementTree.ParseError:
            errors.append("sitemap.xml: invalid XML")
    else:
        errors.append("missing sitemap.xml")
    return errors


def main() -> int:
    errors = audit_site(ROOT)
    if errors:
        print("Hynoe Flicks site verification failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print("Hynoe Flicks site verification passed with zero errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
