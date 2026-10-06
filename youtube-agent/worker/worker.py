from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from faster_whisper import WhisperModel
from supabase import create_client
from yt_dlp import YoutubeDL

load_dotenv()

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_PUBLISHABLE_KEY"]
EMAIL = os.environ["HYN_AGENT_EMAIL"]
PASSWORD = os.environ["HYN_AGENT_PASSWORD"]
WORKER_ID = os.getenv("WORKER_ID", "hynoe-rtx4070")
WORK_DIR = Path(os.getenv("WORK_DIR", "./work")).resolve()
FFMPEG = os.getenv("FFMPEG_BIN", "ffmpeg")
FFPROBE = os.getenv("FFPROBE_BIN", "ffprobe")
WHISPER_MODEL = os.getenv("WHISPER_MODEL", "large-v3")
WHISPER_COMPUTE = os.getenv("WHISPER_COMPUTE_TYPE", "float16")
MAX_CLIPS = int(os.getenv("MAX_CLIPS", "8"))
MIN_CLIP_SECONDS = int(os.getenv("MIN_CLIP_SECONDS", "15"))
MAX_CLIP_SECONDS = int(os.getenv("MAX_CLIP_SECONDS", "45"))

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
WORK_DIR.mkdir(parents=True, exist_ok=True)

KEYWORDS = {
    "legendary": 12, "rare": 9, "boss": 10, "killed": 6, "died": 8, "death": 8,
    "what": 4, "no way": 9, "oh my": 8, "bro": 4, "crazy": 7, "insane": 8,
    "finally": 6, "found": 6, "got it": 7, "let's go": 9, "wtf": 8, "damn": 5,
    "broke": 5, "bug": 7, "destroyed": 7, "win": 6, "lost": 5, "almost": 4,
    "netherite": 6, "enderium": 8, "vulpus": 8, "vibranium": 8, "campaign": 4,
}

@dataclass
class Segment:
    start: float
    end: float
    text: str

@dataclass
class Candidate:
    start: float
    end: float
    score: int
    category: str
    excerpt: str
    reasons: list[str]


def run(cmd: list[str]) -> None:
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def update_job(job_id: str, state: str, code: str | None = None, message: str | None = None) -> None:
    result = supabase.rpc("update_job_state", {
        "p_job_id": job_id,
        "p_state": state,
        "p_error_code": code,
        "p_error_message": message,
    }).execute()
    if getattr(result, "data", None) is None and getattr(result, "error", None):
        raise RuntimeError(str(result.error))


def login() -> None:
    res = supabase.auth.sign_in_with_password({"email": EMAIL, "password": PASSWORD})
    if not res.user:
        raise RuntimeError("Supabase login failed")
    print(f"Signed in as {res.user.email}")


def claim_job() -> dict[str, Any] | None:
    res = supabase.rpc("claim_next_job", {"p_worker_id": WORKER_ID, "p_lease_seconds": 1800}).execute()
    rows = res.data or []
    return rows[0] if rows else None


def download_source(job: dict[str, Any], job_dir: Path) -> Path:
    update_job(job["job_id"], "downloading")
    local_uri = job.get("source_uri")
    if local_uri and Path(local_uri).exists():
        src = Path(local_uri).resolve()
        dst = job_dir / src.name
        shutil.copy2(src, dst)
        return dst

    video_id = job.get("youtube_video_id")
    if not video_id:
        raise RuntimeError("No local source path or YouTube video ID is available")

    output = str(job_dir / "source.%(ext)s")
    opts = {
        "outtmpl": output,
        "format": "bv*+ba/b",
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": False,
    }
    with YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    matches = list(job_dir.glob("source.*"))
    if not matches:
        raise RuntimeError("yt-dlp finished but no source file was created")
    return matches[0]


def transcribe(source: Path, job: dict[str, Any]) -> list[Segment]:
    update_job(job["job_id"], "transcribing")
    model = WhisperModel(WHISPER_MODEL, device="cuda", compute_type=WHISPER_COMPUTE)
    raw_segments, _ = model.transcribe(str(source), vad_filter=True, word_timestamps=False)
    segments = [Segment(float(s.start), float(s.end), s.text.strip()) for s in raw_segments if s.text.strip()]
    rows = [{
        "channel_id": job["channel_id"],
        "video_source_id": job["video_source_id"],
        "start_ms": int(s.start * 1000),
        "end_ms": int(s.end * 1000),
        "text": s.text,
    } for s in segments]
    for i in range(0, len(rows), 300):
        supabase.table("transcript_segments").insert(rows[i:i+300]).execute()
    return segments


def keyword_score(text: str) -> tuple[int, list[str]]:
    lower = text.lower()
    total = 0
    reasons: list[str] = []
    for phrase, weight in KEYWORDS.items():
        if phrase in lower:
            total += weight
            reasons.append(f"keyword:{phrase}")
    bangs = min(text.count("!"), 4)
    questions = min(text.count("?"), 3)
    total += bangs * 2 + questions
    if bangs:
        reasons.append("excited delivery")
    if len(text) > 150:
        total += 4
        reasons.append("substantial context")
    return total, reasons


def category_for(text: str) -> str:
    t = text.lower()
    if any(x in t for x in ("died", "death", "killed me", "i'm dead", "lost")):
        return "death_fail_rage"
    if any(x in t for x in ("boss", "fight", "combat")):
        return "boss_combat"
    if any(x in t for x in ("rare", "legendary", "found", "drop", "enderium", "vulpus", "vibranium")):
        return "rare_discovery"
    if any(x in t for x in ("build", "base", "finished", "reveal")):
        return "build_reveal"
    if any(x in t for x in ("bug", "broken", "glitch")):
        return "bug_chaos"
    if any(x in t for x in ("campaign", "stage", "progress", "finally")):
        return "progression"
    if any(x in t for x in ("how to", "you can", "the way you", "tutorial")):
        return "tutorial_insight"
    if any(x in t for x in ("bro", "no way", "what", "wtf", "damn", "crazy", "insane")):
        return "funny_reaction"
    return "other"


def build_candidates(segments: list[Segment]) -> list[Candidate]:
    if not segments:
        return []
    scored: list[Candidate] = []
    for i, seg in enumerate(segments):
        base, reasons = keyword_score(seg.text)
        if base < 4:
            continue
        start = max(0.0, seg.start - 4.0)
        end = min(segments[-1].end, max(seg.end + 12.0, start + MIN_CLIP_SECONDS))
        j = i + 1
        while j < len(segments) and end - start < min(MAX_CLIP_SECONDS, 28):
            end = max(end, min(segments[j].end + 3.0, start + MAX_CLIP_SECONDS))
            j += 1
        text = " ".join(s.text for s in segments if s.end >= start and s.start <= end)
        extra, extra_reasons = keyword_score(text)
        score = min(100, 38 + base + min(30, extra // 2))
        if 18 <= end - start <= 32:
            score += 6
            reasons.append("strong Shorts length")
        score = min(100, score)
        reasons.extend(extra_reasons[:4])
        scored.append(Candidate(start, end, score, category_for(text), text[:650], list(dict.fromkeys(reasons))[:8]))

    scored.sort(key=lambda c: c.score, reverse=True)
    selected: list[Candidate] = []
    for c in scored:
        overlap = False
        for existing in selected:
            inter = max(0.0, min(c.end, existing.end) - max(c.start, existing.start))
            smaller = min(c.end-c.start, existing.end-existing.start)
            if smaller and inter / smaller > 0.45:
                overlap = True
                break
        if not overlap:
            selected.append(c)
        if len(selected) >= MAX_CLIPS:
            break
    return selected


def write_srt(segments: list[Segment], start: float, end: float, path: Path) -> None:
    def ts(seconds: float) -> str:
        ms = max(0, int(seconds * 1000))
        h, ms = divmod(ms, 3_600_000); m, ms = divmod(ms, 60_000); s, ms = divmod(ms, 1000)
        return f"{h:02}:{m:02}:{s:02},{ms:03}"
    chosen = [s for s in segments if s.end >= start and s.start <= end]
    with path.open("w", encoding="utf-8") as f:
        for idx, s in enumerate(chosen, 1):
            a = max(0, s.start - start); b = min(end-start, s.end-start)
            f.write(f"{idx}\n{ts(a)} --> {ts(b)}\n{s.text}\n\n")


def render_clip(source: Path, c: Candidate, segments: list[Segment], out: Path) -> None:
    srt = out.with_suffix(".srt")
    write_srt(segments, c.start, c.end, srt)
    escaped = str(srt).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    vf = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=24:2[bg];"
        "[0:v]scale=1080:-2:force_original_aspect_ratio=decrease[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2[base];"
        f"[base]subtitles='{escaped}':force_style='FontName=Arial,FontSize=19,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=3,Shadow=0,Alignment=2,MarginV=120'[v]"
    )
    run([FFMPEG, "-y", "-ss", f"{c.start:.3f}", "-i", str(source), "-t", f"{c.end-c.start:.3f}",
         "-filter_complex", vf, "-map", "[v]", "-map", "0:a?", "-c:v", "h264_nvenc", "-preset", "p5",
         "-cq", "21", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out)])


def title_for(c: Candidate, topic: str | None) -> str:
    lead = {
        "death_fail_rage": "I Was NOT Ready For This",
        "boss_combat": "This Fight Got Out of Control",
        "rare_discovery": "I Actually Found It",
        "build_reveal": "This Build Was Worth It",
        "bug_chaos": "Minecraft Completely Broke",
        "progression": "This Changed My Entire Run",
        "tutorial_insight": "I Wish I Knew This Earlier",
        "funny_reaction": "Nah This Was Crazy",
        "other": "This Escalated Fast",
    }[c.category]
    return f"{lead} | {topic}" if topic else lead


def upload_candidates(source: Path, job: dict[str, Any], segments: list[Segment], candidates: list[Candidate], job_dir: Path) -> None:
    update_job(job["job_id"], "rendering")
    for idx, c in enumerate(candidates, 1):
        clip_id = str(uuid.uuid4())
        out = job_dir / f"clip-{idx:02}.mp4"
        render_clip(source, c, segments, out)
        storage_path = f"{job['channel_id']}/{clip_id}.mp4"
        with out.open("rb") as fh:
            supabase.storage.from_("clip-previews").upload(storage_path, fh, {"content-type": "video/mp4", "upsert": "false"})
        supabase.table("clip_candidates").insert({
            "id": clip_id,
            "channel_id": job["channel_id"],
            "video_source_id": job["video_source_id"],
            "processing_job_id": job["job_id"],
            "start_ms": int(c.start*1000),
            "end_ms": int(c.end*1000),
            "category": c.category,
            "score": c.score,
            "score_reasons": c.reasons,
            "transcript_excerpt": c.excerpt,
            "hook": title_for(c, job.get("game_topic")),
            "title": title_for(c, job.get("game_topic")),
            "description": f"Best moment from Hynoe's {job.get('game_topic') or 'gaming'} stream. Source: @Hynoe",
            "hashtags": ["Hynoe", "gaming", "shorts"],
            "render_uri": storage_path,
            "render_status": "ready",
        }).execute()


def process(job: dict[str, Any]) -> None:
    job_dir = WORK_DIR / job["job_id"]
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        source = download_source(job, job_dir)
        segments = transcribe(source, job)
        update_job(job["job_id"], "analyzing")
        candidates = build_candidates(segments)
        if not candidates:
            supabase.table("video_sources").update({"source_status": "no_viable_clips"}).eq("id", job["video_source_id"]).execute()
            update_job(job["job_id"], "completed")
            print("No viable clips; completed without forcing output")
            return
        upload_candidates(source, job, segments, candidates, job_dir)
        supabase.table("video_sources").update({"source_status": "ready"}).eq("id", job["video_source_id"]).execute()
        update_job(job["job_id"], "awaiting_review")
        print(f"Rendered {len(candidates)} clip candidates")
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        try:
            update_job(job["job_id"], "failed_retryable", type(exc).__name__, str(exc)[:1000])
        finally:
            raise


def main() -> None:
    login()
    one_shot = "--once" in sys.argv
    while True:
        job = claim_job()
        if not job:
            print("No queued jobs")
            if one_shot:
                return
            time.sleep(30)
            continue
        print(json.dumps(job, indent=2, default=str))
        process(job)
        if one_shot:
            return


if __name__ == "__main__":
    main()
