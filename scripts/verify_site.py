from __future__ import annotations

import json
import re
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
    html: str


def _attr(html: str, pattern: str) -> str:
    match = re.search(pattern, html, flags=re.I | re.S)
    return match.group(1).strip() if match else ""


def discover_html_pages(root: Path) -> list[Path]:
    return [root / name for name in PRODUCTION_PAGES if (root / name).exists()]


def parse_page(path: Path) -> PageAudit:
    html = path.read_text(encoding="utf-8")
    blocks: list[dict] = []
    for raw in re.findall(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', html, flags=re.I | re.S):
        try:
            blocks.append(json.loads(raw))
        except json.JSONDecodeError:
            blocks.append({"__invalid__": True})
    return PageAudit(
        path=path,
        title=_attr(html, r"<title>(.*?)</title>"),
        description=_attr(html, r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)'),
        canonical=_attr(html, r'<link[^>]+rel=["\']canonical["\'][^>]+href=["\']([^"\']+)'),
        h1_count=len(re.findall(r"<h1\b", html, flags=re.I)),
        og_title=_attr(html, r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\']([^"\']*)'),
        og_url=_attr(html, r'<meta[^>]+property=["\']og:url["\'][^>]+content=["\']([^"\']*)'),
        og_image=_attr(html, r'<meta[^>]+property=["\']og:image["\'][^>]+content=["\']([^"\']*)'),
        twitter_card=_attr(html, r'<meta[^>]+name=["\']twitter:card["\'][^>]+content=["\']([^"\']*)'),
        json_ld_blocks=blocks,
        html=html,
    )


def _local_asset_paths(html: str) -> set[str]:
    values = set(re.findall(r'(?:src|href)=["\']([^"\']+)["\']', html, flags=re.I))
    local = set()
    for value in values:
        if value.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:")):
            continue
        clean = value.split("?", 1)[0].split("#", 1)[0]
        if not clean or clean.endswith(".html") or clean == "/":
            continue
        local.add(clean.lstrip("/"))
    return local


def audit_site(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    pages = discover_html_pages(root)
    missing = [name for name in PRODUCTION_PAGES if not (root / name).exists()]
    errors.extend(f"missing page: {name}" for name in missing)

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
        if not audit.og_title:
            errors.append(f"{label}: missing og:title")
        if not audit.og_url.startswith(DOMAIN):
            errors.append(f"{label}: missing/invalid og:url")
        if not audit.og_image.startswith(DOMAIN):
            errors.append(f"{label}: missing/invalid og:image")
        if not audit.twitter_card:
            errors.append(f"{label}: missing twitter:card")
        if not audit.json_ld_blocks:
            errors.append(f"{label}: missing JSON-LD")
        for block in audit.json_ld_blocks:
            if block.get("__invalid__"):
                errors.append(f"{label}: invalid JSON-LD")
        if "hynoegeshi.github.io" in audit.html.lower():
            errors.append(f"{label}: GitHub Pages hostname leaked into production metadata")
        if re.search(r'assets/img/p[1-8]\.jpg', audit.html, flags=re.I):
            errors.append(f"{label}: directly references a multi-megabyte original portfolio image")
        for tag in re.findall(r'<img\b[^>]*>', audit.html, flags=re.I):
            if not re.search(r'\balt=["\'][^"\']*["\']', tag, flags=re.I):
                errors.append(f"{label}: image missing alt attribute")
        for asset in _local_asset_paths(audit.html):
            if not (root / asset).exists():
                errors.append(f"{label}: missing local asset {asset}")

    robots = root / "robots.txt"
    if robots.exists():
        value = robots.read_text(encoding="utf-8")
        if f"Sitemap: {DOMAIN}/sitemap.xml" not in value:
            errors.append("robots.txt: wrong sitemap URL")
        if "hynoegeshi.github.io" in value.lower():
            errors.append("robots.txt: old GitHub Pages hostname present")
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
            if any("hynoegeshi.github.io" in (loc or "").lower() for loc in locs):
                errors.append("sitemap.xml: old GitHub Pages hostname present")
        except ElementTree.ParseError:
            errors.append("sitemap.xml: invalid XML")
    else:
        errors.append("missing sitemap.xml")

    css = root / "assets" / "css" / "site.css"
    if not css.exists() or "prefers-reduced-motion" not in css.read_text(encoding="utf-8"):
        errors.append("site.css: missing reduced-motion support")

    booking = root / "booking.html"
    if booking.exists():
        html = booking.read_text(encoding="utf-8")
        for field_id in re.findall(r'<(?:input|textarea|select)\b[^>]*\bid=["\']([^"\']+)', html, flags=re.I):
            if field_id == "website":
                continue
            if not re.search(rf'<label[^>]+for=["\']{re.escape(field_id)}["\']', html, flags=re.I):
                errors.append(f"booking.html: field {field_id} is missing an associated label")

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
