from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import uuid
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from faster_whisper import WhisperModel
from supabase import create_client
from yt_dlp import YoutubeDL

from clip_quality import Candidate, Segment, build_candidates, build_short_metadata, caption_cues, make_title, preview_video_bitrate_kbps

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
MIN_CLIP_SCORE = int(os.getenv("MIN_CLIP_SCORE", "76"))

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
WORK_DIR.mkdir(parents=True, exist_ok=True)


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
    res = supabase.rpc("claim_next_job", {"p_worker_id": WORKER_ID, "p_lease_seconds": 7200}).execute()
    rows = res.data or []
    return rows[0] if rows else None


def _existing_source(job_dir: Path) -> Path | None:
    valid = {".mp4", ".mkv", ".webm", ".mov"}
    choices = [p for p in job_dir.glob("source.*") if p.suffix.lower() in valid and p.is_file()]
    choices = [p for p in choices if p.stat().st_size > 10 * 1024 * 1024]
    return max(choices, key=lambda p: p.stat().st_size) if choices else None


def download_source(job: dict[str, Any], job_dir: Path) -> Path:
    cached = _existing_source(job_dir)
    if cached:
        print(f"Reusing downloaded source: {cached}")
        return cached

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
        "format": "bv*[height<=1080]+ba/b[height<=1080]/b",
        "merge_output_format": "mp4",
        "noplaylist": True,
        "quiet": False,
        "concurrent_fragment_downloads": 8,
        "retries": 10,
        "fragment_retries": 10,
    }
    with YoutubeDL(opts) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={video_id}"])
    cached = _existing_source(job_dir)
    if not cached:
        raise RuntimeError("yt-dlp finished but no source file was created")
    return cached


def load_existing_segments(job: dict[str, Any]) -> list[Segment]:
    res = (
        supabase.table("transcript_segments")
        .select("start_ms,end_ms,text")
        .eq("video_source_id", job["video_source_id"])
        .order("start_ms")
        .limit(5000)
        .execute()
    )
    rows = res.data or []
    if len(rows) < 10:
        return []
    seen: set[tuple[int, int, str]] = set()
    segments: list[Segment] = []
    for row in rows:
        key = (int(row["start_ms"]), int(row["end_ms"]), str(row["text"]))
        if key in seen:
            continue
        seen.add(key)
        segments.append(Segment(key[0] / 1000.0, key[1] / 1000.0, key[2]))
    print(f"Reusing {len(segments)} existing transcript segments")
    return segments


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
        supabase.table("transcript_segments").insert(rows[i:i + 300]).execute()
    return segments


def _ass_ts(seconds: float) -> str:
    cs = max(0, int(round(seconds * 100)))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02}:{s:02}.{cs:02}"


def _ass_escape(text: str) -> str:
    return text.replace("\\", r"\\").replace("{", r"\{").replace("}", r"\}").replace("\n", r"\N")


def write_ass(segments: list[Segment], c: Candidate, topic: str | None, path: Path) -> None:
    hook = make_title(c, None)
    cues = caption_cues(segments, c.start, c.end, max_words=5)
    header = """[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Hook,Arial,58,&H0042A9D8,&H00FFFFFF,&H00000000,&H70000000,-1,0,0,0,100,100,0,0,3,4,0,8,70,70,105,1\nStyle: Caption,Arial,64,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,3,3,0,2,65,65,155,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"""
    with path.open("w", encoding="utf-8-sig") as f:
        f.write(header)
        hook_end = min(4.5, max(1.8, c.end - c.start))
        f.write(f"Dialogue: 0,{_ass_ts(0)},{_ass_ts(hook_end)},Hook,,0,0,0,,{_ass_escape(hook)}\n")
        for a, b, text in cues:
            if b <= a:
                continue
            f.write(f"Dialogue: 0,{_ass_ts(a)},{_ass_ts(b)},Caption,,0,0,0,,{_ass_escape(text)}\n")


def render_clip(source: Path, c: Candidate, segments: list[Segment], out: Path, topic: str | None) -> None:
    ass = out.with_suffix(".ass")
    write_ass(segments, c, topic, ass)
    escaped = str(ass).replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
    vf = (
        "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,"
        "boxblur=30:3,eq=brightness=-0.22:saturation=0.82[bg];"
        "[0:v]scale=1260:-2,crop=1080:ih:(iw-1080)/2:0[fg];"
        "[bg][fg]overlay=(W-w)/2:(H-h)/2[base];"
        f"[base]subtitles='{escaped}'[v]"
    )
    duration = max(0.1, c.end - c.start)
    maxrate_kbps = preview_video_bitrate_kbps(duration)
    bufsize_kbps = maxrate_kbps * 2
    run([
        FFMPEG, "-y", "-ss", f"{c.start:.3f}", "-i", str(source), "-t", f"{duration:.3f}",
        "-filter_complex", vf, "-map", "[v]", "-map", "0:a?",
        "-c:v", "h264_nvenc", "-preset", "p5", "-cq", "25", "-maxrate", f"{maxrate_kbps}k", "-bufsize", f"{bufsize_kbps}k",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", str(out),
    ])


def cleanup_previous_candidates(job: dict[str, Any]) -> None:
    rows = (
        supabase.table("clip_candidates")
        .select("id,render_uri")
        .eq("processing_job_id", job["job_id"])
        .execute()
        .data
        or []
    )
    paths = [row.get("render_uri") for row in rows if row.get("render_uri")]
    if paths:
        try:
            supabase.storage.from_("clip-previews").remove(paths)
        except Exception as exc:
            print(f"Preview cleanup warning: {exc}")
    if rows:
        supabase.table("clip_candidates").delete().eq("processing_job_id", job["job_id"]).execute()
        print(f"Removed {len(rows)} previous clip candidates")


def upload_candidates(source: Path, job: dict[str, Any], segments: list[Segment], candidates: list[Candidate], job_dir: Path) -> None:
    update_job(job["job_id"], "rendering")
    for idx, c in enumerate(candidates, 1):
        clip_id = str(uuid.uuid4())
        out = job_dir / f"clip-v2-{idx:02}.mp4"
        render_clip(source, c, segments, out, job.get("game_topic"))
        storage_path = f"{job['channel_id']}/{clip_id}.mp4"
        with out.open("rb") as fh:
            supabase.storage.from_("clip-previews").upload(
                storage_path, fh, {"content-type": "video/mp4", "upsert": "false"}
            )
        metadata = build_short_metadata(c, job.get("game_topic"), job.get("youtube_video_id"))
        title = str(metadata["title"])
        supabase.table("clip_candidates").insert({
            "id": clip_id,
            "channel_id": job["channel_id"],
            "video_source_id": job["video_source_id"],
            "processing_job_id": job["job_id"],
            "start_ms": int(c.start * 1000),
            "end_ms": int(c.end * 1000),
            "category": c.category,
            "score": c.score,
            "score_reasons": c.reasons,
            "transcript_excerpt": c.excerpt,
            "hook": make_title(c, None),
            "title": title,
            "description": metadata["description"],
            "hashtags": metadata["hashtags"],
            "render_uri": storage_path,
            "render_status": "ready",
        }).execute()
        print(f"Ready {idx}/{len(candidates)}: {title} ({c.score}/100)")


def process(job: dict[str, Any], rebuild: bool = False) -> None:
    job_dir = WORK_DIR / job["job_id"]
    job_dir.mkdir(parents=True, exist_ok=True)
    try:
        source = download_source(job, job_dir)
        segments = load_existing_segments(job)
        if not segments:
            segments = transcribe(source, job)
        update_job(job["job_id"], "analyzing")
        candidates = build_candidates(segments, max_clips=MAX_CLIPS, min_score=MIN_CLIP_SCORE)
        print(f"Quality gate selected {len(candidates)} real clip candidates")
        for c in candidates:
            print(f"  {c.score}/100 {c.start:.1f}-{c.end:.1f}s {make_title(c, job.get('game_topic'))}")
        if rebuild:
            cleanup_previous_candidates(job)
        if not candidates:
            supabase.table("video_sources").update({"source_status": "no_viable_clips"}).eq("id", job["video_source_id"]).execute()
            update_job(job["job_id"], "completed")
            print("No viable clips; completed without forcing output")
            return
        upload_candidates(source, job, segments, candidates, job_dir)
        supabase.table("video_sources").update({"source_status": "ready"}).eq("id", job["video_source_id"]).execute()
        update_job(job["job_id"], "awaiting_review")
        print(f"Rendered {len(candidates)} quality-gated clip candidates")
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        try:
            update_job(job["job_id"], "failed_retryable", type(exc).__name__, str(exc)[:1000])
        finally:
            raise


def main() -> None:
    login()
    one_shot = "--once" in sys.argv
    rebuild = "--rebuild" in sys.argv
    while True:
        job = claim_job()
        if not job:
            print("No queued jobs")
            if one_shot:
                return
            time.sleep(30)
            continue
        print(json.dumps(job, indent=2, default=str))
        process(job, rebuild=rebuild)
        if one_shot:
            return


if __name__ == "__main__":
    main()
