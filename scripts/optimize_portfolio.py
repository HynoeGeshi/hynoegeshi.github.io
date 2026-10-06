from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SIZES = {"thumb": 640, "card": 1280, "large": 2200}
WEBP_QUALITY = {"thumb": 76, "card": 80, "large": 84}
JPEG_QUALITY = {"thumb": 78, "card": 82, "large": 86}


def _resized(image: Image.Image, max_width: int) -> Image.Image:
    if image.width <= max_width:
        return image.copy()
    ratio = max_width / image.width
    return image.resize((max_width, max(1, round(image.height * ratio))), Image.Resampling.LANCZOS)


def build_derivatives(source: Path, output_root: Path, stem: str) -> dict[str, Any]:
    output_root.mkdir(parents=True, exist_ok=True)
    result: dict[str, Any] = {}
    with Image.open(source) as raw:
        oriented = ImageOps.exif_transpose(raw).convert("RGB")
        result["sourceWidth"] = oriented.width
        result["sourceHeight"] = oriented.height
        for kind, width in SIZES.items():
            out_dir = output_root / kind
            out_dir.mkdir(parents=True, exist_ok=True)
            resized = _resized(oriented, width)
            webp = out_dir / f"{stem}.webp"
            jpg = out_dir / f"{stem}.jpg"
            resized.save(webp, "WEBP", quality=WEBP_QUALITY[kind], method=6)
            resized.save(jpg, "JPEG", quality=JPEG_QUALITY[kind], optimize=True, progressive=True)
            result[kind] = str(webp.relative_to(output_root)).replace("\\", "/")
            result[f"{kind}Jpeg"] = str(jpg.relative_to(output_root)).replace("\\", "/")
            result[f"{kind}Width"] = resized.width
            result[f"{kind}Height"] = resized.height
    return result


def process_repo(root: Path = ROOT) -> list[dict[str, Any]]:
    output = root / "assets" / "img" / "portfolio"
    report: list[dict[str, Any]] = []
    for index in range(1, 9):
        source = root / "assets" / "img" / f"p{index}.jpg"
        if not source.exists():
            continue
        result = build_derivatives(source, output, f"p{index}")
        result["id"] = f"p{index}"
        report.append(result)
    return report


def check_sizes(root: Path = ROOT) -> list[str]:
    limits = {"thumb": 180_000, "card": 420_000, "large": 950_000}
    errors: list[str] = []
    for kind, limit in limits.items():
        folder = root / "assets" / "img" / "portfolio" / kind
        if not folder.exists():
            errors.append(f"missing derivative folder: {folder}")
            continue
        for path in folder.glob("*.webp"):
            size = path.stat().st_size
            if size > limit:
                errors.append(f"{path.relative_to(root)} is {size} bytes, over {limit}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--report", action="store_true")
    args = parser.parse_args()
    if args.check:
        errors = check_sizes(ROOT)
        if errors:
            print("\n".join(errors))
            return 1
        print("Portfolio derivative sizes are within targets.")
        return 0
    report = process_repo(ROOT)
    if args.report:
        print(json.dumps(report, indent=2))
    else:
        print(f"Generated derivatives for {len(report)} portfolio images.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
